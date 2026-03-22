import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = (width - 40) / COLUMN_COUNT;

export default function CalendarScreen({ navigation }) {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayPhotos, setDayPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const yearScrollRef = React.useRef(null);

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

  const years = Array.from({ length: 31 }, (_, i) => 2000 + i);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Photo Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.calendarCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}>
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
                {years.map(y => (
                  <TouchableOpacity 
                    key={y} 
                    onPress={() => setYear(y)}
                    style={[styles.yearChip, currentDate.getFullYear() === y && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.yearText, currentDate.getFullYear() === y && { color: '#fff' }]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <Text style={[styles.pickerLabel, { color: colors.textSecondary, marginTop: 15 }]}>Select Month</Text>
              <View style={styles.monthGrid}>
                {months.map((m, idx) => (
                  <TouchableOpacity 
                    key={m} 
                    onPress={() => setMonth(idx)}
                    style={[styles.monthCard, currentDate.getMonth() === idx && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.monthCardText, currentDate.getMonth() === idx && { color: '#fff' }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
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
                      style={[styles.dateCell, active && { backgroundColor: colors.primary }]}
                    >
                      <Text style={[
                          styles.dateText, 
                          { color: item.current ? colors.text : colors.searchPlaceholder },
                          active && { color: '#fff' }
                      ]}>
                        {item.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
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
            {dayPhotos.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.photoItem}
                onPress={() => navigation.navigate('Viewer', {
                  item,
                  allItems: dayPhotos,
                  initialIndex: index
                })}
              >
                <Image source={{ uri: item.uri }} style={styles.gridImage} contentFit="cover" />
              </TouchableOpacity>
            ))}
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
  calendarCard: {
    margin: 16,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
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
  },
  dateCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderRadius: 20,
  },
  dateText: { fontSize: 15, fontWeight: '600' },
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
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCard: {
    width: (width - 120) / 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  monthCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
