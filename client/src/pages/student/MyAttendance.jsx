import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CalendarIcon, 
  CheckIcon, 
  XMarkIcon,
  UserIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import api from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import SEO from '../../components/SEO';

const MyAttendance = () => {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [statistics, setStatistics] = useState({
    totalDays: 0,
    presentDays: 0,
    fullyPresentDays: 0,
    partiallyPresentDays: 0,
    absentDays: 0,
    attendancePercentage: 0
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchMyAttendance();
  }, [dateRange]);

  const fetchMyAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const response = await api.get(`/api/attendance/my-attendance?${params}`);
      
      if (response.data.success) {
        setAttendance(response.data.data.attendance);
        setStatistics(response.data.data.statistics);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStatus = (record) => {
    if (record.morning && record.evening) return 'Present';
    if (record.morning || record.evening) return 'Partial';
    return 'Absent';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'text-green-600 bg-green-50';
      case 'Partial': return 'text-yellow-600 bg-yellow-50';
      case 'Absent': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Present': return <CheckIcon className="w-4 h-4" />;
      case 'Partial': return <ClockIcon className="w-4 h-4" />;
      case 'Absent': return <XMarkIcon className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAttendanceTrend = () => {
    if (statistics.attendancePercentage >= 90) return { text: 'Excellent', color: 'text-green-600', icon: '🎉' };
    if (statistics.attendancePercentage >= 75) return { text: 'Good', color: 'text-blue-600', icon: '👍' };
    if (statistics.attendancePercentage >= 60) return { text: 'Fair', color: 'text-yellow-600', icon: '⚠️' };
    return { text: 'Needs Improvement', color: 'text-red-600', icon: '📈' };
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const trend = getAttendanceTrend();

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <SEO title="My Attendance - Student Dashboard" />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                My Attendance
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Track your attendance records and statistics</p>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{statistics.attendancePercentage}%</div>
              <div className={`text-sm font-medium ${trend.color}`}>
                {trend.icon} {trend.text}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-blue-600" />
            Attendance Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-500">Total Days</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{statistics.totalDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-500">Present Days</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{statistics.presentDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-500">Fully Present</p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-600">{statistics.fullyPresentDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-500">Partially Present</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{statistics.partiallyPresentDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-500">Absent Days</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600">{statistics.absentDays}</p>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-gray-500">Attendance %</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">{statistics.attendancePercentage}%</p>
            </div>
          </div>
        </motion.div>

        {/* Date Range Controls */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Date Range
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Attendance Records */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
              Attendance Records ({attendance.length})
            </h2>
          </div>

          {/* Mobile Card View */}
          <div className="block sm:hidden">
            {attendance.map((record, index) => {
              const status = getAttendanceStatus(record);
              return (
                <motion.div
                  key={record._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{formatDate(record.date)}</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {getStatusIcon(status)}
                      <span className="ml-1">{status}</span>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <SunIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Morning</span>
                      </div>
                      {record.morning ? (
                        <CheckIcon className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-600 mx-auto" />
                      )}
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MoonIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Evening</span>
                      </div>
                      {record.evening ? (
                        <CheckIcon className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-red-600 mx-auto" />
                      )}
                    </div>
                  </div>
                  
                  {record.notes && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Notes:</span> {record.notes}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <CalendarDaysIcon className="w-4 h-4 inline mr-1" />
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SunIcon className="w-4 h-4 inline mr-1" />
                    Morning
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <MoonIcon className="w-4 h-4 inline mr-1" />
                    Evening
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendance.map((record, index) => {
                  const status = getAttendanceStatus(record);
                  return (
                    <motion.tr
                      key={record._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.date)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {record.morning ? (
                          <CheckIcon className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-red-600 mx-auto" />
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {record.evening ? (
                          <CheckIcon className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-red-600 mx-auto" />
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                          <span className="ml-1">{status}</span>
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.notes || '-'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {attendance.length === 0 && (
            <div className="text-center py-12">
              <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No attendance records found for the selected date range.</p>
            </div>
          )}
        </motion.div>

        {/* Attendance Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 sm:mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
            Attendance Tips
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">📅 Regular Attendance</p>
              <p>Maintaining regular attendance helps in academic performance and hostel compliance.</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">⏰ Morning & Evening</p>
              <p>Both morning and evening attendance are important for hostel management.</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">📊 Track Progress</p>
              <p>Monitor your attendance percentage to stay on track with hostel requirements.</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">🎯 Set Goals</p>
              <p>Aim for 90%+ attendance to maintain good standing in the hostel.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyAttendance; 