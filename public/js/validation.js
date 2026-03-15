// ── Core validators ───────────────────────────────────────────────────────────

export function validateNumber(input, min = 0, max = Number.MAX_VALUE) {
    if (input === null || input === undefined || input === '') {
        return { isValid: false, error: 'Değer gereklidir' };
    }
    const num = Number(input);
    if (isNaN(num)) return { isValid: false, error: 'Geçerli bir sayı giriniz' };
    if (num < min)  return { isValid: false, error: `Değer en az ${min} olmalıdır` };
    if (num > max)  return { isValid: false, error: `Değer en fazla ${max} olabilir` };
    return { isValid: true, value: num };
}

export function validateString(input, minLength = 1, maxLength = 100) {
    if (input === null || input === undefined) return { isValid: false, error: 'Metin gereklidir' };
    const str = String(input).trim();
    if (str.length < minLength) return { isValid: false, error: `En az ${minLength} karakter olmalıdır` };
    if (str.length > maxLength) return { isValid: false, error: `En fazla ${maxLength} karakter olabilir` };
    return { isValid: true, value: str };
}

// ── Specific field validators ─────────────────────────────────────────────────

export function validateEmail(email) {
    const result = validateString(email, 5, 254);
    if (!result.isValid) return result;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.value)) {
        return { isValid: false, error: 'Geçerli bir e-posta adresi giriniz' };
    }
    return result;
}

export function validateUsername(username) {
    const result = validateString(username, 3, 30);
    if (!result.isValid) return result;
    if (!/^[a-zA-Z0-9_]+$/.test(result.value)) {
        return { isValid: false, error: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir' };
    }
    return result;
}

export function validatePassword(password) {
    const result = validateString(password, 8, 100);
    if (!result.isValid) return result;

    const errors = [];
    if (!/[A-Z]/.test(result.value)) errors.push('En az bir büyük harf');
    if (!/[a-z]/.test(result.value)) errors.push('En az bir küçük harf');
    if (!/\d/.test(result.value))    errors.push('En az bir rakam');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(result.value)) errors.push('En az bir özel karakter');

    if (errors.length > 0) {
        return { isValid: false, error: `Şifre ${errors.join(', ')} içermelidir` };
    }
    return result;
}

export function validateDate(date, minDate = new Date('1900-01-01'), maxDate = new Date()) {
    if (!date) return { isValid: false, error: 'Tarih gereklidir' };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { isValid: false, error: 'Geçerli bir tarih giriniz' };
    if (d < minDate) return { isValid: false, error: `Tarih ${minDate.toLocaleDateString('tr-TR')} tarihinden sonra olmalıdır` };
    if (d > maxDate) return { isValid: false, error: `Tarih ${maxDate.toLocaleDateString('tr-TR')} tarihinden önce olmalıdır` };
    return { isValid: true, value: d };
}

// ── Legacy helpers (kept for backwards compatibility) ─────────────────────────

/** Returns a boolean — used by auth.js */
export function isSecurePassword(password) {
    if (!password || password.length < 8) return false;
    return /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /\d/.test(password)    &&
           /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

/** Returns an errors array — used by portfolio.js */
export function validatePortfolioData(symbol, quantity, price) {
    const errors = [];
    if (!symbol || symbol.trim() === '') errors.push('Sembol gereklidir');

    if (quantity === null || quantity === undefined || quantity === '') {
        errors.push('Miktar gereklidir');
    } else if (isNaN(quantity)) {
        errors.push('Geçerli bir miktar giriniz (sayısal değer)');
    } else if (parseFloat(quantity) <= 0) {
        errors.push('Miktar 0\'dan büyük olmalıdır');
    }

    if (price === null || price === undefined || price === '') {
        errors.push('Alış fiyatı gereklidir');
    } else if (isNaN(price)) {
        errors.push('Geçerli bir alış fiyatı giriniz (sayısal değer)');
    } else if (parseFloat(price) <= 0) {
        errors.push('Alış fiyatı 0\'dan büyük olmalıdır');
    }

    return errors;
}

/** Returns an errors array — used by fx.js */
export function validateFxData(fxName, quantity, price) {
    const errors = [];
    if (!fxName || fxName.trim() === '') errors.push('Döviz türü gereklidir');
    if (!quantity || isNaN(quantity) || quantity <= 0) errors.push('Geçerli bir miktar giriniz');
    if (!price    || isNaN(price)    || price    <= 0) errors.push('Geçerli bir alış fiyatı giriniz');
    return errors;
}

// ── Composite validators ──────────────────────────────────────────────────────

export function validatePortfolioItem(symbol, quantity, price, type = 'stock') {
    const errors = [];
    const symbolResult   = validateString(symbol,   2,    20);
    const quantityResult = validateNumber(quantity, 0.01);
    const priceResult    = validateNumber(price,    0.01);

    if (!symbolResult.isValid)   errors.push({ field: 'symbol',   message: symbolResult.error });
    if (!quantityResult.isValid) errors.push({ field: 'quantity', message: quantityResult.error });
    if (!priceResult.isValid)    errors.push({ field: 'price',    message: priceResult.error });
    if (!['stock', 'fx'].includes(type)) {
        errors.push({ field: 'type', message: 'Geçerli bir tür seçiniz (stock veya fx)' });
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: {
            symbol:   symbolResult.value,
            quantity: quantityResult.value,
            price:    priceResult.value,
            type
        }
    };
}

export function validateFxItem(fxName, quantity, price) {
    const errors = [];
    const fxNameResult   = validateString(fxName,   2,    20);
    const quantityResult = validateNumber(quantity, 0.01);
    const priceResult    = validateNumber(price,    0.01);

    if (!fxNameResult.isValid)   errors.push({ field: 'fxName',   message: fxNameResult.error });
    if (!quantityResult.isValid) errors.push({ field: 'quantity', message: quantityResult.error });
    if (!priceResult.isValid)    errors.push({ field: 'price',    message: priceResult.error });

    return {
        isValid: errors.length === 0,
        errors,
        data: { fxName: fxNameResult.value, quantity: quantityResult.value, price: priceResult.value }
    };
}

export function validateUserRegistration(name, surname, birthdate, username, password) {
    const errors = [];
    const checks = [
        ['name',      validateString(name,     2, 50)],
        ['surname',   validateString(surname,  2, 50)],
        ['birthdate', validateDate(birthdate)],
        ['username',  validateUsername(username)],
        ['password',  validatePassword(password)]
    ];
    for (const [field, result] of checks) {
        if (!result.isValid) errors.push({ field, message: result.error });
    }
    return {
        isValid: errors.length === 0,
        errors,
        data: {
            name:      checks[0][1].value,
            surname:   checks[1][1].value,
            birthdate: checks[2][1].value,
            username:  checks[3][1].value,
            password:  checks[4][1].value
        }
    };
}

export function validateUserLogin(username, password) {
    const errors = [];
    const usernameResult = validateString(username, 3, 30);
    const passwordResult = validateString(password, 8, 100);
    if (!usernameResult.isValid) errors.push({ field: 'username', message: usernameResult.error });
    if (!passwordResult.isValid) errors.push({ field: 'password', message: passwordResult.error });
    return {
        isValid: errors.length === 0,
        errors,
        data: { username: usernameResult.value, password: passwordResult.value }
    };
}

export function validateForm(formData, schema) {
    const errors = [];
    const validatedData = {};
    for (const [field, validator] of Object.entries(schema)) {
        const result = validator(formData[field]);
        if (!result.isValid) errors.push({ field, message: result.error });
        else validatedData[field] = result.value;
    }
    return { isValid: errors.length === 0, errors, data: validatedData };
}

export const validationSchemas = {
    portfolio: {
        symbol:   (v) => validateString(v, 2, 20),
        quantity: (v) => validateNumber(v, 0.01),
        price:    (v) => validateNumber(v, 0.01),
        type:     (v) => {
            if (!['stock', 'fx'].includes(v)) return { isValid: false, error: 'Geçerli bir tür seçiniz' };
            return { isValid: true, value: v };
        }
    },
    userRegistration: {
        name:      (v) => validateString(v, 2, 50),
        surname:   (v) => validateString(v, 2, 50),
        birthdate: (v) => validateDate(v),
        username:  (v) => validateUsername(v),
        password:  (v) => validatePassword(v)
    },
    userLogin: {
        username: (v) => validateString(v, 3, 30),
        password: (v) => validateString(v, 8, 100)
    }
};
