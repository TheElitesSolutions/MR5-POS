import * as z from 'zod';
// Common validation schemas
export const emailSchema = z
    .string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required');
// Enhanced password validation schema
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number')
    .regex(/(?=.*[@$!%*?&])/, 'Password must contain at least one special character (@$!%*?&)');
// Username validation schema
export const usernameSchema = z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');
// Name validation schema
export const nameSchema = z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must not exceed 100 characters')
    .trim();
export const priceSchema = z
    .number()
    .positive('Price must be positive')
    .max(999999, 'Price is too high')
    .refine(val => Number.isFinite(val), 'Price must be a valid number');
export const quantitySchema = z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .max(10000, 'Quantity is too high');
export const descriptionSchema = z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .optional();
// Menu item validation
export const menuItemSchema = z.object({
    name: z
        .string()
        .min(1, 'Item name is required')
        .max(100, 'Item name must not exceed 100 characters'),
    description: descriptionSchema,
    price: priceSchema,
    category: z
        .string()
        .min(1, 'Category is required')
        .max(50, 'Category must not exceed 50 characters'),
    isAvailable: z.boolean(),
    isActive: z.boolean(),
    isCustomizable: z.boolean().default(false), // ✅ NEW: Add isCustomizable field
    ingredients: z
        .array(z.object({
        stockItemId: z.string().min(1, 'Stock item is required'),
        quantityRequired: z
            .number()
            .positive('Quantity must be positive')
            .max(1000, 'Quantity is too high'),
    }))
        .optional(),
});
// Stock item validation
export const stockItemSchema = z.object({
    name: z
        .string()
        .min(1, 'Item name is required')
        .max(100, 'Item name must not exceed 100 characters'),
    unit: z
        .string()
        .min(1, 'Unit is required')
        .max(20, 'Unit must not exceed 20 characters'),
    currentQuantity: quantitySchema,
    minimumQuantity: quantitySchema,
    costPerUnit: priceSchema,
    category: z
        .string()
        .min(1, 'Category is required')
        .max(50, 'Category must not exceed 50 characters'),
});
// Order validation
export const orderItemSchema = z.object({
    menuItemId: z.string().min(1, 'Menu item is required'),
    quantity: z
        .number()
        .int('Quantity must be a whole number')
        .min(1, 'Quantity must be at least 1')
        .max(100, 'Quantity is too high'),
    specialInstructions: z
        .string()
        .max(200, 'Special instructions must not exceed 200 characters')
        .optional(),
});
// User validation
export const userSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(['OWNER', 'MANAGER', 'EMPLOYEE']),
});
// Login validation schema
export const loginSchema = z.object({
    username: usernameSchema,
    password: z.string().min(1, 'Password is required'),
});
// Registration validation schema
export const registerSchema = z
    .object({
    username: usernameSchema,
    name: nameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['OWNER', 'MANAGER', 'EMPLOYEE']).optional(),
})
    .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});
// Table validation
export const tableSchema = z.object({
    name: z
        .string()
        .min(1, 'Table name is required')
        .max(50, 'Table name is too long')
        .trim(),
    isActive: z.boolean(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
});
// Date range validation
export const dateRangeSchema = z
    .object({
    startDate: z.date(),
    endDate: z.date(),
})
    .refine(data => data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
});
// Validation helper functions
export const validateEmail = (email) => {
    try {
        emailSchema.parse(email);
        return true;
    }
    catch {
        return false;
    }
};
export const validatePassword = (password) => {
    try {
        passwordSchema.parse(password);
        return true;
    }
    catch {
        return false;
    }
};
export const validatePrice = (price) => {
    try {
        priceSchema.parse(price);
        return true;
    }
    catch {
        return false;
    }
};
export const validateQuantity = (quantity) => {
    try {
        quantitySchema.parse(quantity);
        return true;
    }
    catch {
        return false;
    }
};
// Form validation with detailed error messages
export const validateForm = (schema, data) => {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errors = {};
            error.issues.forEach(err => {
                const path = err.path.join('.');
                errors[path] = err.message;
            });
            return { success: false, errors };
        }
        return { success: false, errors: { general: 'Validation failed' } };
    }
};
// Sanitization functions
export const sanitizeString = (input) => {
    return input.trim().replace(/\s+/g, ' ');
};
export const sanitizeNumber = (input) => {
    const num = typeof input === 'string' ? parseFloat(input) : input;
    return isNaN(num) ? 0 : num;
};
export const sanitizeInteger = (input) => {
    const num = typeof input === 'string' ? parseInt(input, 10) : Math.floor(input);
    return isNaN(num) ? 0 : num;
};
// API response validation
export const apiResponseSchema = z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
});
export const validateApiResponse = (response) => {
    return validateForm(apiResponseSchema, response);
};
// Custom validation rules
export const createCustomValidation = (validator, message) => {
    return z.custom(value => validator(value), { message });
};
// Async validation helper
export const validateAsync = async (schema, data) => {
    try {
        const validatedData = await schema.parseAsync(data);
        return { success: true, data: validatedData };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errors = {};
            error.issues.forEach(err => {
                const path = err.path.join('.');
                errors[path] = err.message;
            });
            return { success: false, errors };
        }
        return { success: false, errors: { general: 'Validation failed' } };
    }
};
// Password strength checker
export const checkPasswordStrength = (password) => {
    // Handle undefined/null password gracefully
    if (!password || typeof password !== 'string') {
        return {
            score: 0,
            feedback: ['Enter a password'],
            isStrong: false,
        };
    }
    const feedback = [];
    let score = 0;
    if (password.length >= 8)
        score += 1;
    else
        feedback.push('Use at least 8 characters');
    if (/[a-z]/.test(password))
        score += 1;
    else
        feedback.push('Include lowercase letters');
    if (/[A-Z]/.test(password))
        score += 1;
    else
        feedback.push('Include uppercase letters');
    if (/\d/.test(password))
        score += 1;
    else
        feedback.push('Include numbers');
    if (/[@$!%*?&]/.test(password))
        score += 1;
    else
        feedback.push('Include special characters (@$!%*?&)');
    if (password.length >= 12)
        score += 1;
    if (/(?=.*[a-z].*[a-z])/.test(password))
        score += 0.5;
    if (/(?=.*[A-Z].*[A-Z])/.test(password))
        score += 0.5;
    if (/(?=.*\d.*\d)/.test(password))
        score += 0.5;
    return {
        score: Math.min(score, 5),
        feedback,
        isStrong: score >= 5 && feedback.length === 0,
    };
};
// Input sanitization
export const sanitizeInput = (input) => {
    return input.trim().replace(/[<>]/g, '');
};
