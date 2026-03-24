import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { scanGalleryWithAI, loadCachedAIResults, clearAICache, isAIAvailable } from '../services/aiService';

const AIContext = createContext();

export const useAI = () => useContext(AIContext);

export const AIProvider = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastScannedUri, setLastScannedUri] = useState(null); // Used for UI animations
  const [results, setResults] = useState(null);
  const [scannedAt, setScannedAt] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  
  // Track if a scan is already in progress to avoid duplicates
  const scanInProgressRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      const supported = await isAIAvailable();
      setIsSupported(supported);
      
      const cached = await loadCachedAIResults();
      if (cached) {
        setResults(cached.results);
        setScannedAt(cached.scannedAt);
      }
    };
    init();
  }, []);

  const startScan = async () => {
    if (scanInProgressRef.current) return;
    
    scanInProgressRef.current = true;
    setIsAnalyzing(true);
    setProgress({ current: 0, total: 0 });

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
          scanInProgressRef.current = false;
          setIsAnalyzing(false);
          return;
      }

      // 1. Fetch assets for scanning (similar to SmartAlbumsScreen logic)
      let allAssets = [];
      let hasNextPage = true;
      let after = null;

      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1000,
          after: after,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]]
        });
        allAssets = [...allAssets, ...result.assets];
        hasNextPage = result.hasNextPage;
        after = result.endCursor;
        if (allAssets.length >= 10000) break;
      }

      const uriLookup = {};
      allAssets.forEach(a => uriLookup[a.id] = a.uri);

      // 2. Perform background analysis
      const scanResults = await scanGalleryWithAI(
        allAssets.map(a => ({ id: a.id, uri: a.uri })),
        (current, total, category, id) => {
          // PERFORMANCE: Throttle UI updates to every 10 items to reduce re-renders
          if (current % 10 === 0 || current === total) {
              setProgress({ current, total });
              if (uriLookup[id]) {
                setLastScannedUri(uriLookup[id]);
              }
          }
        }
      );

      setResults(scanResults);
      setScannedAt(Date.now());
    } catch (error) {
      console.error('AI Scan Error:', error);
    } finally {
      setIsAnalyzing(false);
      scanInProgressRef.current = false;
    }
  };

  const clearResults = async () => {
    await clearAICache();
    setResults(null);
    setScannedAt(null);
  };

  return (
    <AIContext.Provider value={{
      isAnalyzing,
      progress,
      lastScannedUri,
      results,
      scannedAt,
      isSupported,
      startScan,
      clearResults
    }}>
      {children}
    </AIContext.Provider>
  );
};
