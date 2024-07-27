import React, { useState } from 'react';
import { isImageRef } from '../utils';
import { isBlurhashString, isThumbhashString } from '../utils/resolveSources';
function findBestSourceForSize(sources, size) {
    if (sources?.length === 1) {
        return sources[0];
    }
    return ([...(sources || [])]
        // look for the smallest image that's still larger then a container
        ?.map((source) => {
        if (!size) {
            return { source, penalty: 0, covers: false };
        }
        const { width, height } = typeof source === 'object' ? source : { width: null, height: null };
        if (width == null || height == null) {
            return { source, penalty: 0, covers: false };
        }
        if (width < size.width || height < size.height) {
            return {
                source,
                penalty: Math.max(size.width - width, size.height - height),
                covers: false,
            };
        }
        return { source, penalty: (width - size.width) * (height - size.height), covers: true };
    })
        .sort((a, b) => a.penalty - b.penalty)
        .sort((a, b) => Number(b.covers) - Number(a.covers))[0]?.source ?? null);
}
function getCSSMediaQueryForSource(source) {
    return `(max-width: ${source.webMaxViewportWidth ?? source.width}px) ${source.width}px`;
}
function selectSource(sources, size, responsivePolicy) {
    if (sources == null || sources.length === 0) {
        return null;
    }
    if (sources.length === 1) {
        return sources[0];
    }
    if (responsivePolicy !== 'static') {
        return findBestSourceForSize(sources, size);
    }
    const staticSupportedSources = sources
        .filter((s) => s.uri && s.width != null && !isBlurhashString(s.uri) && !isThumbhashString(s.uri))
        .sort((a, b) => (a.webMaxViewportWidth ?? a.width ?? 0) - (b.webMaxViewportWidth ?? b.width ?? 0));
    if (staticSupportedSources.length === 0) {
        console.warn("You've set the `static` responsivePolicy but none of the sources have the `width` properties set. Make sure you set both `width` and `webMaxViewportWidth` for best results when using static responsiveness. Falling back to the `initial` policy.");
        return findBestSourceForSize(sources, size);
    }
    const srcset = staticSupportedSources
        ?.map((source) => `${source.uri} ${source.width}w`)
        .join(', ');
    const sizes = `${staticSupportedSources
        ?.map(getCSSMediaQueryForSource)
        .join(', ')}, ${staticSupportedSources[staticSupportedSources.length - 1]?.width}px`;
    return {
        srcset,
        sizes,
        uri: staticSupportedSources[staticSupportedSources.length - 1]?.uri ?? '',
        type: 'srcset',
    };
}
export default function useSourceSelection(sources, responsivePolicy = 'static', containerRef, measurementCallback = null) {
    const hasMoreThanOneSource = (Array.isArray(sources) ? sources.length : 0) > 1;
    const [size, setSize] = useState(containerRef.current?.getBoundingClientRect() ?? null);
    if (size && containerRef.current) {
        measurementCallback?.(containerRef.current, size);
    }
    React.useEffect(() => {
        if ((!hasMoreThanOneSource && !measurementCallback) || !containerRef.current) {
            return () => { };
        }
        if (responsivePolicy === 'live') {
            const resizeObserver = new ResizeObserver((entries) => {
                setSize(entries[0].contentRect);
                measurementCallback?.(entries[0].target, entries[0].contentRect);
            });
            resizeObserver.observe(containerRef.current);
            return () => {
                resizeObserver.disconnect();
            };
        }
        return () => { };
    }, [responsivePolicy, hasMoreThanOneSource, containerRef.current, measurementCallback]);
    if (isImageRef(sources)) {
        // There is always only one image ref, so there is nothing else to select from.
        return sources;
    }
    return selectSource(sources, size, responsivePolicy);
}
//# sourceMappingURL=useSourceSelection.js.map