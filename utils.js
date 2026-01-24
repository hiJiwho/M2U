/**
 * Mail 2 U - Advanced Variable Utilities
 * Handles substitution of {Variable} macros in letter content.
 */

const VariableUtils = {
    // 1. Device & OS Detection
    getDeviceInfo: () => {
        const ua = navigator.userAgent;
        const platform = navigator.platform;

        // Device Type
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const Device = isMobile ? 'Mobile' : 'Desktop';

        // OS Detection
        let OS = 'OTHER';
        if (/iPhone|iPad|iPod/i.test(ua)) OS = 'IOS';
        else if (/Android/i.test(ua)) OS = 'ANDROID';
        else if (/Win/i.test(ua)) OS = 'WINDOWS';
        else if (/Mac/i.test(ua)) OS = 'MACOS';
        else if (/Linux/i.test(ua)) OS = 'LINUX';
        else if (/CrOS/i.test(ua)) OS = 'CHROMEOS';

        // Browser Detection
        let Browser = 'Other';
        if (/Edg/.test(ua)) Browser = 'Edge';
        else if (/Chrome/.test(ua) && !/Edg/.test(ua)) Browser = 'Chrome';
        else if (/Safari/.test(ua) && !/Chrome/.test(ua)) Browser = 'Safari';
        else if (/Firefox/.test(ua)) Browser = 'FireFox';
        else if (/Whale/.test(ua)) Browser = 'Whale';

        return { Device, OS, Browser };
    },

    // 2. Display Info
    getDisplayInfo: () => {
        const w = window.screen.width;
        const h = window.screen.height;
        const ratio = w >= h ? 'Landscape' : 'Portrait';

        let res = 'SD';
        if (w >= 3840) res = '4K';
        else if (w >= 2560) res = 'QHD';
        else if (w >= 1920) res = 'FHD';
        else if (w >= 1280) res = 'HD';

        return {
            ScreenW: w,
            ScreenH: h,
            Resolution: `${res} ${ratio}`, // e.g., "FHD Landscape"
            DarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'
        };
    },

    // 3. Time Info
    getTimeInfo: () => {
        const now = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            weekday: days[now.getDay()],
            time: now.toLocaleTimeString(),
            ampm: now.getHours() >= 12 ? '오후' : '오전'
        };
    },

    // 4. Random Logic
    getRandom: (type, param) => {
        if (type === 'Rand') {
            if (param && param.includes('-')) {
                const [min, max] = param.split('-').map(Number);
                if (!isNaN(min) && !isNaN(max)) {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
            }
            return Math.floor(Math.random() * 100) + 1; // Default 1-100
        }
        if (type === 'Coin') return Math.random() > 0.5 ? '앞면' : '뒷면';
        if (type === 'Dice') return Math.floor(Math.random() * 6) + 1;
        return '';
    },

    // Main Parse Function
    parse: async (text, contextData = {}) => {
        if (!text) return '';

        const deviceInfo = VariableUtils.getDeviceInfo();
        const displayInfo = VariableUtils.getDisplayInfo();
        const timeInfo = VariableUtils.getTimeInfo();

        let filled = text;

        // A. Static Variables (User Context)
        // contextData usually comes from DB (receiverName, senderName, etc.)
        // /{name} -> receiverName, /{role} -> receiverRole, /{sender} -> senderName
        filled = filled.replace(/\/\{name\}/gi, contextData.receiverName || '');
        filled = filled.replace(/\/\{role\}/gi, contextData.receiverRole || '');
        filled = filled.replace(/\/\{sender\}/gi, contextData.senderName || '');

        // B. Environment Variables
        const vars = { ...deviceInfo, ...displayInfo, ...timeInfo };
        for (const [key, val] of Object.entries(vars)) {
            const regex = new RegExp(`\/\\{${key}\\}`, 'gi');
            filled = filled.replace(regex, val);
        }

        // C. Random (/{Rand:1-10}, /{Coin}, /{Dice})
        filled = filled.replace(/\/\{Rand:([\d-]+)\}/g, (_, range) => VariableUtils.getRandom('Rand', range));
        filled = filled.replace(/\/\{Rand\}/g, () => VariableUtils.getRandom('Rand'));
        filled = filled.replace(/\/\{Coin\}/g, () => VariableUtils.getRandom('Coin'));
        filled = filled.replace(/\/\{Dice\}/g, () => VariableUtils.getRandom('Dice'));

        // D. Async Variables (Network, Weather) - Only if placeholders exist
        // /{IP}
        if (filled.includes('/{IP}')) {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                filled = filled.replace(/\/\{IP\}/g, data.ip);
            } catch (e) {
                filled = filled.replace(/\/\{IP\}/g, 'Unknown IP');
            }
        }
        // /{Weather} - Seoul default for now, can be improved to use geolocation if allowed
        if (filled.includes('/{Weather}')) {
            try {
                const res = await fetch('https://wttr.in/?format=%C+%t'); // Cond + Temp
                const weatherText = await res.text();
                filled = filled.replace(/\/\{Weather\}/g, weatherText.trim());
            } catch (e) {
                filled = filled.replace(/\/\{Weather\}/g, 'Unknown Weather');
            }
        }

        // E. Logic Processing (Conditionals) using recursive replacement to handle nesting if needed (simple loop here)
        // Syntax: /{Key=Val=Output}, /{Key!=Val=Output}, /{Key?Output}
        // Key refers to keys in 'vars' object (Device, OS, Browser, etc.)

        // Helper to get logic value
        const getValue = (key) => vars[key] || contextData[key] || key; // key itself if literal? No, strict key match first.

        // Pattern: /{Key=Val=Text}
        // Note: Regex logic is tricky for arbitrary text. We assume Text doesn't contain '}'.
        // 1. Equality /{Key=Val=Text}
        filled = filled.replace(/\/\{(\w+)=([^=]+)=([^}]+)\}/g, (match, key, val, output) => {
            const currentVal = String(vars[key] || key); // If key not in vars, use string literal? Let's match vars only.
            // Actually, let's allow vars checking.
            if (String(vars[key]).toLowerCase() === val.toLowerCase()) return output;
            return '';
        });

        // 2. Inequality /{Key!=Val=Text}
        filled = filled.replace(/\/\{(\w+)!=\s*([^=]+)=([^}]+)\}/g, (match, key, val, output) => {
            if (String(vars[key]).toLowerCase() !== val.toLowerCase()) return output;
            return '';
        });

        // 3. Truthy/Environment Specific Shorthand /{Key:Text}
        // Expanding to generic /{Key:Text} where Key is boolean-like or checks existence?
        // User asked for /{Mob:Text}/{Des:Text}. Let's map Mob->Mobile, Des->Desktop aliases if specific.
        // Or just generic: If 'vars[key] === true' or 'vars[key] === key' (like Device=Mobile) ?

        // Simpler Logic: Specific replacements for the requested format: /{Key:Value} is NOT standard JSON.
        // User req: `/{Mob:핸드폰...}`, `/{Des:컴퓨터...}`
        // Let's create aliases
        const logicVars = { ...vars, Mob: vars.Device === 'Mobile', Des: vars.Device === 'Desktop' };

        // Universal "If True" Pattern: /{Key:Text}
        // We look for Keys in logicVars. If truthy, replace with Text. If falsey, remove.
        // Warning: This conflicts with simple JSON objects if present. But we use it for macros.
        // To be safe, we iterate known boolean keys or check existence.

        filled = filled.replace(/\/\{(\w+):([^}]+)\}/g, (match, key, text) => {
            // Check aliases first
            if (logicVars[key]) return text;

            // Check direct equality (e.g. /{IOS:Text} -> if OS=='IOS')
            if (vars.OS === key.toUpperCase()) return text;
            if (vars.Browser === key) return text;

            // Default: if key not recognized as true condition, return empty string (hide)
            // OR return original if it's not a logic tag? 
            // User wants /{Mob:Text}, so we imply if NOT mob, remove it.
            return '';
        });

        return filled;
    }
};

window.VariableUtils = VariableUtils;
