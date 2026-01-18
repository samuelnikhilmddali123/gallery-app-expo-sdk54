import React from 'react';
import { View } from 'react-native';
import Svg, { Image as SvgImage, Defs, Filter, FeColorMatrix } from 'react-native-svg';

/**
 * FilteredImage Component
 * Uses ColorMatrix via react-native-svg to apply high-performance filters.
 * 
 * @param {string} uri - Image URI
 * @param {number} width - Component width
 * @param {number} height - Component height
 * @param {string} filterType - Type of filter to apply ('blackwhite', 'sepia', 'vintage', 'cool', 'warm')
 */
/**
 * FilteredImage Component
 * Uses ColorMatrix via react-native-svg to apply high-performance filters.
 */
export default React.forwardRef(({ uri, width, height, filterType, brightness = 1, contrast = 1, saturation = 1 }, ref) => {
    // Helper to get filter matrix
    const getFilterMatrix = (type) => {
        switch (type) {
            case 'blackwhite': return `0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0`;
            case 'sepia': return `0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0`;
            case 'vintage': return `0.9 0 0 0 0 0 0.8 0 0 0 0 0 0.5 0 0 0 0 0 1 0`;
            case 'cool': return `0.7 0 0 0 0 0 0.9 0 0 0 0 0 1.2 0 0 0 0 0 1 0`;
            case 'warm': return `1.2 0 0 0 0 0 0.9 0 0 0 0 0 0.7 0 0 0 0 0 1 0`;
            default: return null;
        }
    };

    // Helper for saturation matrix
    const getSaturationMatrix = (s) => {
        const lumR = 0.3086;
        const lumG = 0.6094;
        const lumB = 0.0820;
        const sr = (1 - s) * lumR;
        const sg = (1 - s) * lumG;
        const sb = (1 - s) * lumB;
        return `
            ${sr + s} ${sg} ${sb} 0 0
            ${sr} ${sg + s} ${sb} 0 0
            ${sr} ${sg} ${sb + s} 0 0
            0 0 0 1 0
        `;
    };

    // Helper for contrast matrix
    const getContrastMatrix = (c) => {
        const t = (1.0 - c) / 2.0;
        return `
            ${c} 0 0 0 ${t}
            0 ${c} 0 0 ${t}
            0 0 ${c} 0 ${t}
            0 0 0 1 0
        `;
    };

    // Helper for brightness matrix
    const getBrightnessMatrix = (b) => {
        // b = 1 is normal. <1 dark, >1 bright.
        // Simple scaling:
        return `
            ${b} 0 0 0 0
            0 ${b} 0 0 0
            0 0 ${b} 0 0
            0 0 0 1 0
        `;
    };

    const filterMatrix = getFilterMatrix(filterType);
    const satMatrix = getSaturationMatrix(saturation);
    const conMatrix = getContrastMatrix(contrast);
    const briMatrix = getBrightnessMatrix(brightness);

    return (
        <View ref={ref} style={{ width, height, overflow: 'hidden' }} collapsable={false}>
            <Svg width="100%" height="100%">
                <Defs>
                    <Filter id="combinedFilter">
                        {/* 1. Apply Preset Filter (if any) */}
                        {filterMatrix && <FeColorMatrix type="matrix" values={filterMatrix} result="FILTERED" />}

                        {/* 2. Apply Saturation */}
                        <FeColorMatrix
                            in={filterMatrix ? "FILTERED" : "SourceGraphic"}
                            type="matrix"
                            values={satMatrix}
                            result="SATURATED"
                        />

                        {/* 3. Apply Contrast */}
                        <FeColorMatrix
                            in="SATURATED"
                            type="matrix"
                            values={conMatrix}
                            result="CONTRASTED"
                        />

                        {/* 4. Apply Brightness - Last step */}
                        <FeColorMatrix
                            in="CONTRASTED"
                            type="matrix"
                            values={briMatrix}
                        />
                    </Filter>
                </Defs>

                <SvgImage
                    href={{ uri }}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                    filter="url(#combinedFilter)"
                />
            </Svg>
        </View>
    );
});
