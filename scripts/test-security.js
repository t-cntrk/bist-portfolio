// Security Test Script for BIST Stocks Dashboard
// Run with: node scripts/test-security.js

const http = require('http');
const https = require('https');

console.log('🔒 BIST Stocks Dashboard - Security Test Suite');
console.log('==============================================\n');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 5000
};

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// Utility function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.setTimeout(TEST_CONFIG.testTimeout);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test function wrapper
function runTest(testName, testFunction) {
  return async () => {
    testResults.total++;
    try {
      await testFunction();
      console.log(`✅ ${testName} - PASSED`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
      testResults.failed++;
    }
  };
}

// Test 1: SQL Injection Prevention
const testSqlInjection = runTest('SQL Injection Prevention', async () => {
  const maliciousPayload = "' OR 1=1; --";
  
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/portfolio',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  }, {
    symbol: maliciousPayload,
    quantity: maliciousPayload,
    purchase: maliciousPayload,
    type: 'stock'
  });
  
  // Should not return 500 error (which would indicate SQL injection)
  if (response.status === 500) {
    throw new Error('Potential SQL injection vulnerability detected');
  }
});

// Test 2: CORS Configuration
const testCORS = runTest('CORS Configuration', async () => {
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/stocks',
    method: 'GET',
    headers: {
      'Origin': 'http://malicious-site.com'
    }
  });
  
  // Should be blocked by CORS
  if (response.status !== 403) {
    throw new Error('CORS not properly configured');
  }
});

// Test 3: Rate Limiting
const testRateLimiting = runTest('Rate Limiting', async () => {
  const requests = [];
  
  // Make 31 requests (exceeding the 30 limit)
  for (let i = 0; i < 31; i++) {
    requests.push(makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stocks/fx',
      method: 'GET'
    }));
  }
  
  const responses = await Promise.all(requests);
  const rateLimited = responses.some(res => res.status === 429);
  
  if (!rateLimited) {
    throw new Error('Rate limiting not working properly');
  }
});

// Test 4: JWT Secret Validation
const testJWTValidation = runTest('JWT Secret Validation', async () => {
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    username: 'test',
    password: 'test'
  });
  
  // Should not crash the server
  if (response.status === 500) {
    throw new Error('Server crashed during JWT validation');
  }
});

// Test 5: CSRF Protection
const testCSRFProtection = runTest('CSRF Protection', async () => {
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    name: 'Test',
    surname: 'User',
    email: 'test@example.com',
    birthdate: '1990-01-01',
    username: 'testuser',
    password: 'TestPass123!'
  });
  
  // Should require CSRF token
  if (response.status !== 403) {
    throw new Error('CSRF protection not working');
  }
});

// Test 6: XSS Prevention
const testXSSPrevention = runTest('XSS Prevention', async () => {
  const maliciousScript = '<script>alert("XSS")</script>';
  
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/portfolio',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  }, {
    symbol: maliciousScript,
    quantity: 1,
    purchase: 100,
    type: 'stock'
  });
  
  // Should not execute script
  if (response.body && response.body.symbol && response.body.symbol.includes('<script>')) {
    throw new Error('XSS prevention not working');
  }
});

// Test 7: Error Handling
const testErrorHandling = runTest('Error Handling', async () => {
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/nonexistent-endpoint',
    method: 'GET'
  });
  
  // Should return proper error response
  if (response.status !== 404) {
    throw new Error('Error handling not working properly');
  }
});

// Test 8: Security Headers
const testSecurityHeaders = runTest('Security Headers', async () => {
  const response = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET'
  });
  
  const requiredHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection'
  ];
  
  for (const header of requiredHeaders) {
    if (!response.headers[header]) {
      throw new Error(`Missing security header: ${header}`);
    }
  }
});

// Run all tests
async function runAllTests() {
  console.log('Starting security tests...\n');
  
  const tests = [
    testSqlInjection,
    testCORS,
    testRateLimiting,
    testJWTValidation,
    testCSRFProtection,
    testXSSPrevention,
    testErrorHandling,
    testSecurityHeaders
  ];
  
  for (const test of tests) {
    await test();
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Print summary
  console.log('\n==============================================');
  console.log('🔒 Security Test Summary');
  console.log('==============================================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All security tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some security tests failed. Please review the issues.');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/test',
      method: 'GET'
    });
    console.log('✅ Server is running on localhost:3000\n');
    return true;
  } catch (error) {
    console.log('❌ Server is not running on localhost:3000');
    console.log('Please start the server with: npm start\n');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await runAllTests();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
