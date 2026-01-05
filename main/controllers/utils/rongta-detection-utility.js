/**
 * RONGTA Detection Utility for mr5-POS
 *
 * This module provides utilities for detecting and identifying
 * RONGTA thermal printer devices and their capabilities.
 */
// RONGTA-specific constants and detection utilities
export class RONGTADetectionUtility {
    /**
     * Check if a USB device is a RONGTA device based on vendor/product IDs
     */
    static isRONGTAUSBDevice(vendorId, productId) {
        const normalizedVendorId = vendorId.toUpperCase().replace('0X', '0x');
        const normalizedProductId = productId.toUpperCase().replace('0X', '0x');
        if (!this.RONGTA_USB_IDS.vendors.includes(normalizedVendorId)) {
            return false;
        }
        const validProducts = this.RONGTA_USB_IDS.products[normalizedVendorId];
        return validProducts ? validProducts.includes(normalizedProductId) : false;
    }
    /**
     * Determine RONGTA capabilities based on model name
     */
    static determineRONGTACapabilities(modelName) {
        const defaultCapabilities = {
            supportsPaperCut: false,
            supportsDrawer: false,
            supportsBarcode: false,
            supportsQrCode: false,
            supportsImages: false,
            paperWidthMm: 58,
            maxPrintSpeed: 90,
            interfaceType: 'USB',
            model: modelName || 'Unknown RONGTA',
            escPosVersion: '1.0',
        };
        // Check against known patterns
        for (const [pattern, specs] of Object.entries(this.RONGTA_MODEL_PATTERNS)) {
            if (modelName.includes(pattern)) {
                return {
                    ...defaultCapabilities,
                    supportsPaperCut: specs.features.includes('cut'),
                    supportsDrawer: specs.features.includes('drawer'),
                    supportsBarcode: specs.features.includes('barcode'),
                    supportsQrCode: specs.features.includes('qr'),
                    supportsImages: specs.features.includes('images'),
                    paperWidthMm: specs.paperWidth,
                    maxPrintSpeed: specs.speed,
                    model: modelName,
                };
            }
        }
        // Default for unknown RONGTA models
        return {
            ...defaultCapabilities,
            supportsPaperCut: true, // Most RONGTA printers have this
            supportsBarcode: true, // Common feature
            model: modelName,
        };
    }
    /**
     * Extract model name from device description or name
     */
    static extractModelName(description, manufacturer) {
        const text = `${description} ${manufacturer || ''}`.toUpperCase();
        // Look for known RONGTA model patterns
        for (const pattern of Object.keys(this.RONGTA_MODEL_PATTERNS)) {
            if (text.includes(pattern)) {
                return pattern;
            }
        }
        // Extract any RP-series model number
        const rpMatch = text.match(/RP\s*[-]?\s*(\d+)/);
        if (rpMatch) {
            return `RP${rpMatch[1]}`;
        }
        return 'RONGTA Unknown Model';
    }
    /**
     * Get network ports commonly used by RONGTA devices
     */
    static getRONGTANetworkPorts() {
        return [...this.RONGTA_NETWORK_PORTS];
    }
    /**
     * Check if a device name/description suggests it's a RONGTA device
     */
    static isRONGTADevice(deviceName, description) {
        const text = `${deviceName} ${description || ''}`.toLowerCase();
        const rongtaIndicators = [
            'rongta',
            'rg-',
            'rp80',
            'rp58',
            'rongta rp',
            'rg58',
            'rg80',
        ];
        return rongtaIndicators.some(indicator => text.includes(indicator));
    }
    /**
     * Get all known RONGTA model patterns
     */
    static getKnownModels() {
        return Object.keys(this.RONGTA_MODEL_PATTERNS);
    }
    /**
     * Get model specifications for a known RONGTA model
     */
    static getModelSpecs(modelName) {
        return this.RONGTA_MODEL_PATTERNS[modelName] || null;
    }
}
// Known RONGTA USB vendor/product IDs
RONGTADetectionUtility.RONGTA_USB_IDS = {
    vendors: ['0x0555', '0x04B8', '0x0FE6', '0x0519'], // Common RONGTA vendor IDs
    products: {
        '0x0555': ['0x0001', '0x0002', '0x0003', '0x0012', '0x0018'], // RONGTA RP series
        '0x04B8': ['0x0202', '0x0203'], // Some RONGTA models
        '0x0FE6': ['0x811E'], // RONGTA thermal printers
        '0x0519': ['0x001A', '0x001B'], // RONGTA POS printers
    },
};
// RONGTA model identification patterns
RONGTADetectionUtility.RONGTA_MODEL_PATTERNS = {
    RP58: { paperWidth: 58, speed: 90, features: ['cut', 'drawer', 'barcode'] },
    RP80: {
        paperWidth: 80,
        speed: 120,
        features: ['cut', 'drawer', 'barcode', 'qr'],
    },
    RP326: {
        paperWidth: 80,
        speed: 150,
        features: ['cut', 'drawer', 'barcode', 'qr', 'images'],
    },
    RP327: {
        paperWidth: 80,
        speed: 200,
        features: ['cut', 'drawer', 'barcode', 'qr', 'images'],
    },
    RP850: {
        paperWidth: 80,
        speed: 250,
        features: ['cut', 'drawer', 'barcode', 'qr', 'images'],
    },
};
// Network scanning ports commonly used by RONGTA devices
RONGTADetectionUtility.RONGTA_NETWORK_PORTS = [80, 8080, 9100, 515];
