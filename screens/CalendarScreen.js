import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, FlatList, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = (width - 40) / COLUMN_COUNT;

export default function CalendarScreen({ navigation }) {
  const { colors, isDarkMode } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayPhotos, setDayPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const yearScrollRef = useRef(null);

  useEffect(() => {
    loadPhotosForDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (isPickerVisible && yearScrollRef.current) {
      // Scroll to current year (approx calc: index * itemWidth)
      const currentYear = currentDate.getFullYear();
      const idx = years.indexOf(currentYear);
      if (idx !== -1) {
          setTimeout(() => {
            yearScrollRef.current?.scrollTo({ x: idx * 75, animated: true });
          }, 100);
      }
    }
  }, [isPickerVisible]);

  const loadPhotosForDate = async (date) => {
    try {
      setLoading(true);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

      const { assets } = await MediaLibrary.getAssetsAsync({
        createdAfter: startOfDay,
        createdBefore: endOfDay,
        mediaType: ['photo', 'video'],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setDayPhotos(assets);
    } catch (e) {
      console.warn('Calendar: Failed to load photos', e);
    } finally {
      setLoading(false);
    }
  };

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Adjust firstDay (0 is Sunday, let's make it Monday-offset)
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    
    const dates = [];
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      dates.push({ day: prevMonthDays - i, month: month - 1, current: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        dates.push({ day: i, month: month, current: true });
    }
    // Next month padding
    const remaining = 42 - dates.length;
    for (let i = 1; i <= remaining; i++) {
        dates.push({ day: i, month: month + 1, current: false });
    }
    return dates;
  };

  const changeMonth = (val) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + val, 1);
    setCurrentDate(next);
  };

  const setYear = (year) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setIsPickerVisible(false);
  };

  const setMonth = (mIdx) => {
    setCurrentDate(new Date(currentDate.getFullYear(), mIdx, 1));
    setIsPickerVisible(false);
  };

  const isSelected = (dateObj) => {
      const d = new Date(currentDate.getFullYear(), dateObj.month, dateObj.day);
      return d.toDateString() === selectedDate.toDateString();
  };
  
  const exitSelectionMode = useCallback(() => {
    Haptics.selectionAsync();
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const toggleSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(itemId);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleItemPress = useCallback((item, index) => {
    const id = item._idStr || item.id.toString();
    
    if (isSelectionMode) {
      // Tap always toggles selection in selection mode
      toggleSelection(id);
    } else {
      // Normal mode -> Open in viewer
      navigation.navigate('Viewer', {
        item,
        allItems: dayPhotos,
        initialIndex: index
      });
    }
  }, [isSelectionMode, dayPhotos, navigation, toggleSelection]);

  const handleLongPress = useCallback((item, index) => {
    const id = item._idStr || item.id.toString();
    
    if (isSelectionMode && selectedItems.has(id)) {
      // Long press on selected -> Open viewer
      navigation.navigate('Viewer', {
        item,
        allItems: dayPhotos,
        initialIndex: index
      });
    } else if (!isSelectionMode) {
      // Long press on unselected -> Start selection mode
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSelectionMode(true);
      setSelectedItems(new Set([id]));
    }
  }, [isSelectionMode, selectedItems, dayPhotos, navigation]);

  // Handle back button for selection mode
  useEffect(() => {
    if (isSelectionMode) {
      const backAction = () => {
        exitSelectionMode();
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [isSelectionMode, exitSelectionMode]);

  const years = Array.from({ length: 31 }, (_, i) => 2000 + i);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity onPress={exitSelectionMode} style={{ padding: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text, fontSize: 18 }]}>
            {selectedItems.size} selected
          </Text>
          <View style={{ width: 60 }} />
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Photo Calendar</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.calendarCardContainer}>
          <BlurView
            intensity={isDarkMode ? 30 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.calendarCard,
              { 
                backgroundColor: colors.surface,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                shadowColor: colors.cardShadow 
              }
            ]}
          >
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={22} color={colors.textSecondary} /></TouchableOpacity>
              
              <TouchableOpacity onPress={() => setIsPickerVisible(!isPickerVisible)} style={styles.headerInfoCenter}>
                <Text style={[styles.monthText, { color: colors.text }]}>
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Text>
                <Ionicons name={isPickerVisible ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            {isPickerVisible ? (
              <View style={styles.pickerContainer}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Select Year</Text>
                <ScrollView 
                  ref={yearScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.yearScroll}
                >
                  {years.map(y => {
                    const isSelectedYear = currentDate.getFullYear() === y;
                    return (
                      <TouchableOpacity 
                        key={y} 
                        onPress={() => setYear(y)}
                        style={[styles.yearChipWrapper, isSelectedYear && { transform: [{ scale: 1.05 }] }]}
                      >
                         <BlurView
                           intensity={isSelectedYear ? 0 : (isDarkMode ? 40 : 60)}
                           tint={isDarkMode ? 'dark' : 'light'}
                           style={[
                             styles.yearChip,
                             { backgroundColor: isSelectedYear ? colors.primary : 'rgba(255,255,255,0.1)' },
                             !isSelectedYear && styles.glassBorder
                           ]}
                         >
                           <Text style={[
                             styles.yearText, 
                             { color: isDarkMode ? '#FFFFFF' : colors.text },
                             isSelectedYear && { color: '#fff', fontWeight: 'bold' }
                           ]}>
                             {y}
                           </Text>
                         </BlurView>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                
                <Text style={[styles.pickerLabel, { color: colors.textSecondary, marginTop: 15 }]}>Select Month</Text>
                <View style={styles.monthGrid}>
                  {months.map((m, idx) => {
                    const isSelectedMonth = currentDate.getMonth() === idx;
                    return (
                      <TouchableOpacity 
                        key={m} 
                        onPress={() => setMonth(idx)}
                        style={[styles.monthCardWrapper, isSelectedMonth && { transform: [{ scale: 1.05 }] }]}
                      >
                         <BlurView
                           intensity={isSelectedMonth ? 0 : (isDarkMode ? 40 : 60)}
                           tint={isDarkMode ? 'dark' : 'light'}
                           style={[
                             styles.monthCard,
                             { backgroundColor: isSelectedMonth ? colors.primary : 'rgba(255,255,255,0.1)' },
                             !isSelectedMonth && styles.glassBorder
                           ]}
                         >
                           <Text style={[
                             styles.monthCardText, 
                             { color: isDarkMode ? '#FFFFFF' : colors.text },
                             isSelectedMonth && { color: '#fff', fontWeight: 'bold' }
                           ]}>
                             {m}
                           </Text>
                         </BlurView>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.daysRow}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <Text key={i} style={[styles.dayLabel, { color: colors.textSecondary }]}>{day}</Text>
                  ))}
                </View>

                <View style={styles.datesGrid}>
                  {generateCalendar().map((item, i) => {
                    const active = isSelected(item);
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setSelectedDate(new Date(currentDate.getFullYear(), item.month, item.day))}
                        style={styles.dateCellWrapper}
                      >
                        {active ? (
                          <View style={[
                            styles.homeGlassBubble,
                            {
                              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                              borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
                              shadowColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                            }
                          ]}>
                            <BlurView 
                              intensity={isDarkMode ? 25 : 35} 
                              tint={isDarkMode ? 'dark' : 'light'} 
                              style={styles.selectedDateGlass}
                            >
                              {/* Inner Glass Highlight Layer */}
                              <View style={[
                                styles.glassHighlight, 
                                { borderColor: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)' }
                              ]} />
                              
                              <Text style={[
                                styles.dateText, 
                                { color: isDarkMode ? '#FFFFFF' : '#000000', zIndex: 2 }
                              ]}>
                                {item.day}
                              </Text>
                            </BlurView>
                          </View>
                        ) : (
                          <Text style={[
                              styles.dateText, 
                              { color: item.current ? colors.text : colors.searchPlaceholder }
                          ]}>
                            {item.day}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </BlurView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Photos on {selectedDate.toLocaleDateString('default', { day: 'numeric', month: 'short' })}
          </Text>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>{dayPhotos.length} items</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.photoGrid}>
            {dayPhotos.map((item, index) => {
              const isVideo = item.mediaType === 'video';
              const id = item._idStr || item.id.toString();
              const isSelected = selectedItems.has(id);
              
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.photoItem}
                  onPress={() => handleItemPress(item, index)}
                  onLongPress={() => handleLongPress(item, index)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: item.uri }} style={styles.gridImage} contentFit="cover" />
                  
                  {isSelected && (
                    <View style={styles.selectionOverlay}>
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    </View>
                  )}

                  {isVideo && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {dayPhotos.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={40} color={colors.border} />
                <Text style={{ color: colors.textSecondary, marginTop: 10 }}>No photos on this day</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  calendarCardContainer: {
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
  },
  calendarCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: { fontSize: 18, fontWeight: '700' },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayLabel: { fontSize: 13, fontWeight: '600', width: 40, textAlign: 'center' },
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  homeGlassBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  glassHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.4)',
    margin: 1,
    opacity: 0.5,
  },
  selectedDateGlass: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { 
    fontSize: 15, 
    fontWeight: '600' 
  },
  selectedDateText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: { 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  countText: { fontSize: 14, fontWeight: '500' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  videoBadge: { 
    position: 'absolute', 
    bottom: 8, 
    right: 8, 
    width: 20, 
    height: 20, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  empty: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 60,
  },
  headerInfoCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickerContainer: {
    marginTop: 10,
    paddingBottom: 10,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  yearScroll: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  yearChipWrapper: {
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  monthCardWrapper: {
    width: (width - 130) / 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  monthCard: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  monthCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  glassBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateCellWrapper: {
    width: (width - 64) / 7,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    justifyContent: 'space-between'
  },
  selectionOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(123, 97, 255, 0.2)', 
    borderWidth: 3, 
    borderColor: '#7B61FF', 
    borderRadius: 8,
    margin: 2
  },
  checkBadge: { 
    position: 'absolute', 
    top: 6, 
    right: 6, 
    width: 20, 
    height: 20, 
    backgroundColor: '#7B61FF', 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderColor: '#fff' 
  },
});
