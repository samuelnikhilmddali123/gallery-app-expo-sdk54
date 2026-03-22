import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DATES = [
  29, 30, 31, 1, 2, 3, 4,
  5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25,
  26, 27, 28, 29, 30, 31, 1
];

export default function CalendarScreen({ navigation }) {
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(17);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Event calendar</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="calendar-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.calendarCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity><Ionicons name="chevron-back" size={20} color={colors.textSecondary} /></TouchableOpacity>
            <Text style={[styles.monthText, { color: colors.text }]}>May 2024</Text>
            <TouchableOpacity><Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={styles.daysRow}>
            {DAYS.map((day, i) => (
              <Text key={i} style={[styles.dayLabel, { color: colors.textSecondary }]}>{day}</Text>
            ))}
          </View>

          <View style={styles.datesGrid}>
            {DATES.map((date, i) => {
              const isToday = date === 17;
              const isOtherMonth = i < 3 || i > 33;
              const isSelected = date === selectedDate;

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.dateCell,
                    isSelected && { backgroundColor: colors.primary }
                  ]}
                >
                  <Text style={[
                    styles.dateText,
                    { color: isOtherMonth ? colors.searchPlaceholder : colors.text },
                    isSelected && { color: '#fff' }
                  ]}>
                    {date}
                  </Text>
                  {isToday && !isSelected && <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Events this day</Text>
        </View>

        <TouchableOpacity style={[styles.eventCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}>
          <View style={styles.eventImagePlaceholder}>
            <Ionicons name="people" size={40} color={colors.primary} />
          </View>
          <View style={styles.eventInfo}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>TeamLab's Team Building</Text>
            <View style={styles.eventDetailRow}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.eventDetail, { color: colors.textSecondary }]}>3:00 PM | 05.17.2024</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.eventDetail, { color: colors.textSecondary }]}>Celebration Haven</Text>
            </View>
            <View style={styles.avatarsRow}>
               {[1,2,3,4,5].map(i => (
                 <View key={i} style={[styles.avatarMini, { backgroundColor: colors.border, marginLeft: i === 1 ? 0 : -10 }]} />
               ))}
               <View style={[styles.avatarCount, { backgroundColor: colors.accent, marginLeft: -10 }]}>
                 <Text style={[styles.avatarCountText, { color: colors.primary }]}>+10</Text>
               </View>
            </View>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: { fontSize: 24, fontWeight: '700' },
  headerIcon: { padding: 5 },
  calendarCard: {
    margin: 20,
    borderRadius: 24,
    padding: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthText: { fontSize: 16, fontWeight: '600' },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  dayLabel: { fontSize: 12, fontWeight: '500', width: 40, textAlign: 'center' },
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
  dateText: { fontSize: 14, fontWeight: '500' },
  todayDot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 5 },
  sectionHeader: { paddingHorizontal: 20, marginTop: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  eventCard: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 20,
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 4,
  },
  eventImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: { flex: 1, marginLeft: 15 },
  eventTitle: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  eventDetail: { fontSize: 12, marginLeft: 5 },
  avatarsRow: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  avatarMini: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  avatarCount: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  avatarCountText: { fontSize: 10, fontWeight: '700' },
});
