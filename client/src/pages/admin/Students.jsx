import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { UserPlusIcon, TableCellsIcon, ArrowUpTrayIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, DocumentDuplicateIcon, PrinterIcon, DocumentArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Course and branch mappings
const COURSES = {
  'B.Tech': 'BTECH',
  'Diploma': 'DIPLOMA',
  'Pharmacy': 'PHARMACY',
  'Degree': 'DEGREE'
};

const BRANCHES = {
  BTECH: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'],
  DIPLOMA: ['DAIML', 'DCSE', 'DECE', 'DME', 'DAP', 'D Fisheries', 'D Animal Husbandry'],
  PHARMACY: ['B-Pharmacy', 'Pharm D', 'Pharm(PB) D', 'Pharmaceutical Analysis', 'Pharmaceutics', 'Pharma Quality Assurance'],
  DEGREE: ['Agriculture', 'Horticulture', 'Food Technology', 'Fisheries', 'Food Science & Nutrition']
};

// Room mappings based on gender and category
const ROOM_MAPPINGS = {
  Male: {
    'A+': ['302', '309', '310', '311', '312'],
    'A': ['303', '304', '305', '306', '308', '320', '324', '325'],
    'B+': ['321'],
    'B': ['314', '315', '316', '317', '322', '323']
  },
  Female: {
    'A+': ['209', '211', '212', '213', '214', '215'],
    'A': ['103', '115', '201', '202', '203', '204', '205', '206', '207', '208', '216', '217'],
    'B': ['101', '102', '104', '105', '106', '108', '109', '111', '112', '114'],
    'C': ['117']
  }
};

const CATEGORIES = ['A+', 'A', 'B+', 'B'];

const ROOM_NUMBERS = Array.from({ length: 11 }, (_, i) => (i + 30).toString());

const TABS = [
  { label: 'Add Student', value: 'add', icon: <UserPlusIcon className="w-5 h-5" /> },
  { label: 'Bulk Upload', value: 'bulkUpload', icon: <ArrowUpTrayIcon className="w-5 h-5" /> },
  { label: 'All Students', value: 'list', icon: <TableCellsIcon className="w-5 h-5" /> },
];

const initialForm = {
  name: '',
  rollNumber: '',
  gender: '',
  course: '',
  year: '',
  branch: '',
  category: '',
  roomNumber: '',
  studentPhone: '',
  parentPhone: '',
  batch: '',
  academicYear: ''
};

// Add BATCHES constant after other constants
const BATCHES = [
  '2022-2026',
  '2023-2027',
  '2024-2028',
  '2025-2029',
  '2026-2030',
  '2027-2031',
  '2028-2032',
  '2029-2033',
  '2030-2034'
];

// Add function to generate batches based on course duration
const generateBatches = (course) => {
  const startFromYear = 2022; // Fixed start year
  const batches = [];
  
  // Determine course duration based on course type
  let duration;
  switch(course) {
    case 'B.Tech':
    case 'Pharmacy':
      duration = 4;
      break;
    case 'Diploma':
    case 'Degree':
      duration = 3;
      break;
    default:
      duration = 4; // Default to 4 years
  }

  // Generate batches starting from 2022 for next 10 years
  for (let i = 0; i < 10; i++) {
    const startYear = startFromYear + i;
    const endYear = startYear + duration;
    batches.push(`${startYear}-${endYear}`);
  }

  return batches;
};

const generateAcademicYears = () => {
  const startYear = 2022;
  const years = [];
  for (let i = 0; i < 10; i++) {
    const academicStart = startYear + i;
    const academicEnd = academicStart + 1;
    years.push(`${academicStart}-${academicEnd}`);
  }
  return years;
};

const Students = () => {
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(initialForm);
  const [adding, setAdding] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    course: '',
    branch: '',
    gender: '',
    category: '',
    roomNumber: '',
    batch: '',
    academicYear: ''
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // State for bulk upload
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [showBulkPreview, setShowBulkPreview] = useState(false);
  const [editablePreviewData, setEditablePreviewData] = useState([]);
  const [previewErrors, setPreviewErrors] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [tempStudentsSummary, setTempStudentsSummary] = useState([]);
  const [loadingTempSummary, setLoadingTempSummary] = useState(false);
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(filters.search);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [filters.search]);

  // Fetch students when tab, currentPage, or filters (excluding direct search) change
  useEffect(() => {
    if (tab === 'list') {
      fetchStudents(true); // Pass true for initialLoad to use setLoading
    } else if (tab === 'bulkUpload') {
      fetchTempStudentsSummary();
    }
  }, [tab]); // Initial load for tab change

  useEffect(() => {
    if (tab === 'list') {
      fetchStudents(false); // Subsequent fetches don't use main setLoading
    }
  }, [currentPage, filters.course, filters.branch, filters.roomNumber, filters.batch, filters.academicYear, debouncedSearchTerm]);

  const fetchTempStudentsSummary = async () => {
    setLoadingTempSummary(true);
    try {
      const res = await api.get('/api/admin/students/temp-summary');
      if (res.data.success) {
        setTempStudentsSummary(res.data.data);
      } else {
        toast.error('Failed to fetch temporary students summary.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error fetching temporary students summary.');
    } finally {
      setLoadingTempSummary(false);
    }
  };

  const fetchStudents = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setTableLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10
      });

      // Add filters only if they have values
      if (filters.search) params.append('search', filters.search);
      if (filters.course) params.append('course', filters.course);
      if (filters.branch) params.append('branch', filters.branch);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.category) params.append('category', filters.category);
      if (filters.roomNumber) params.append('roomNumber', filters.roomNumber);
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.academicYear) params.append('academicYear', filters.academicYear);

      console.log('Filter params:', Object.fromEntries(params)); // Debug log

      const res = await api.get(`/api/admin/students?${params}`);
      if (res.data.success) {
        setStudents(res.data.data.students || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalStudents(res.data.data.totalStudents || 0);
      } else {
        throw new Error(res.data.message || 'Failed to fetch students');
      }
    } catch (err) {
      setError('Failed to fetch students');
      toast.error(err.response?.data?.message || 'Failed to fetch students');
      setStudents([]);
      setTotalPages(1);
      setTotalStudents(0);
    } finally {
      if (initialLoad) {
        setLoading(false);
      } else {
        setTableLoading(false);
      }
    }
  }, [currentPage, filters, debouncedSearchTerm]);

  // Update useEffect for filter changes to include batch
  useEffect(() => {
    if (tab === 'list') {
      fetchStudents(false);
    }
  }, [currentPage, filters.course, filters.branch, filters.gender, filters.category, filters.roomNumber, filters.batch, filters.academicYear, debouncedSearchTerm, fetchStudents]);

  const handleFormChange = e => {
    const { name, value } = e.target;
    setForm(prev => {
      const newForm = { ...prev, [name]: value };
      
      // Reset dependent fields when parent field changes
      if (name === 'course') {
        newForm.branch = '';
        newForm.batch = ''; // Reset batch when course changes
      }
      if (name === 'gender') {
        newForm.category = '';
        newForm.roomNumber = '';
      }
      if (name === 'category') {
        newForm.roomNumber = '';
      }
      
      return newForm;
    });
  };

  const handleAddStudent = async e => {
    e.preventDefault();
    setAdding(true);
    try {
      // Send course label (e.g., 'B.Tech')
      const res = await api.post('/api/admin/students', form);
      toast.success('Student added successfully');
      setForm(initialForm);
      setGeneratedPassword(res.data.data.generatedPassword);
      setShowPasswordModal(true);
      if (tab === 'list') fetchStudents(); // Refresh list if current tab is 'list'
      fetchTempStudentsSummary(); // Refresh pending students list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/admin/students/${id}`);
      toast.success('Student deleted successfully');
      fetchStudents(); // Refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = student => {
    setEditId(student._id);
    setEditForm({
      name: student.name,
      rollNumber: student.rollNumber,
      gender: student.gender,
      course: student.course,
      year: student.year,
      branch: student.branch,
      category: student.category,
      roomNumber: student.roomNumber,
      studentPhone: student.studentPhone,
      parentPhone: student.parentPhone,
      batch: student.batch,
      academicYear: student.academicYear
    });
    setEditModal(true);
  };

  const handleEditFormChange = e => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const newForm = { ...prev, [name]: value };
      
      // Reset dependent fields when parent field changes
      if (name === 'course') {
        newForm.branch = '';
        newForm.batch = ''; // Reset batch when course changes
      }
      if (name === 'gender') {
        newForm.category = '';
        newForm.roomNumber = '';
      }
      if (name === 'category') {
        newForm.roomNumber = '';
      }
      
      return newForm;
    });
  };

  const handleEditSubmit = async e => {
    e.preventDefault();
    setEditing(true);
    try {
      // Validate phone numbers
      if (!/^[0-9]{10}$/.test(editForm.studentPhone)) {
        throw new Error('Student phone number must be 10 digits');
      }
      if (!/^[0-9]{10}$/.test(editForm.parentPhone)) {
        throw new Error('Parent phone number must be 10 digits');
      }

      // Validate room number
      const validRooms = ROOM_MAPPINGS[editForm.gender]?.[editForm.category] || [];
      if (!validRooms.includes(editForm.roomNumber)) {
        throw new Error('Invalid room number for the selected gender and category');
      }

      // Validate batch
      const [startYear, endYear] = editForm.batch.split('-').map(Number);
      const duration = endYear - startYear;
      const expectedDuration = editForm.course === 'B.Tech' || editForm.course === 'Pharmacy' ? 4 : 3;
      if (duration !== expectedDuration) {
        throw new Error(`Invalid batch duration for ${editForm.course}. Must be ${expectedDuration} years.`);
      }

      // Send course label (e.g., 'B.Tech')
      await api.put(`/api/admin/students/${editId}`, editForm);
      toast.success('Student updated successfully');
      setEditModal(false);
      setEditId(null);
      fetchStudents(); // Refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update student');
    } finally {
      setEditing(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value };
      
      // Reset dependent fields when parent field changes
      if (name === 'course') {
        newFilters.branch = '';
      }
      if (name === 'gender') {
        newFilters.category = '';
        newFilters.roomNumber = '';
      }
      if (name === 'category') {
        newFilters.roomNumber = '';
      }
      
      return newFilters;
    });
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Bulk Upload Handlers
  const handleFileChange = (e) => {
    setBulkFile(e.target.files[0]);
    setBulkUploadResults(null); // Clear previous results
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      toast.error('Please select an Excel file to upload.');
      return;
    }
    setBulkProcessing(true);
    setBulkPreview(null);
    setBulkUploadResults(null);
    const formData = new FormData();
    formData.append('file', bulkFile);

    try {
      const res = await api.post('/api/admin/students/bulk-upload-preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data.success) {
        const validStudents = res.data.data.validStudents || [];
        setBulkPreview(res.data.data);
        setEditablePreviewData(validStudents);
        setPreviewErrors(validStudents.map(validateStudentRow));
        setShowBulkPreview(true);
        toast.success('Preview loaded. Please review and edit the data.');
      } else {
        toast.error(res.data.message || 'Failed to generate preview.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'An error occurred during preview generation.';
      toast.error(errorMsg);
      console.error("Bulk preview error:", err.response?.data || err);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleConfirmBulkUpload = async () => {
    const hasErrors = previewErrors.some(errors => Object.keys(errors).length > 0);
    if (hasErrors) {
      toast.error('Please fix all validation errors before confirming.');
      return;
    }

    if (!editablePreviewData || editablePreviewData.length === 0) {
      toast.error('No valid students to upload.');
      return;
    }
    setBulkProcessing(true);
    setBulkUploadResults(null);

    try {
      const res = await api.post('/api/admin/students/bulk-upload-commit', { students: editablePreviewData });
      if (res.data.success) {
        toast.success(res.data.message || 'Bulk upload completed successfully!');
        setBulkUploadResults(res.data.data);
        setShowBulkPreview(false);
        setBulkPreview(null);
        setEditablePreviewData([]);
        setPreviewErrors([]);
        setEditingRow(null);
        fetchTempStudentsSummary();
        if (tab === 'list') {
          fetchStudents(true);
        }
      } else {
        toast.error(res.data.message || 'Commit failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred during commit.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleCancelPreview = () => {
    setShowBulkPreview(false);
    setBulkPreview(null);
    setEditablePreviewData([]);
    setPreviewErrors([]);
    setEditingRow(null);
    setBulkFile(null);
    if (document.getElementById('bulk-file-input')) {
      document.getElementById('bulk-file-input').value = null;
    }
  };

  const getCategoryOptions = (gender) => {
    return gender === 'Male' 
      ? ['A+', 'A', 'B+', 'B']
      : ['A+', 'A', 'B', 'C'];
  };

  const validateStudentRow = (student) => {
    const errors = {};
    const { Name, RollNumber, Gender, Course, Branch, Year, Category, RoomNumber, StudentPhone, ParentPhone, Batch, AcademicYear } = student;
  
    if (!Name) errors.Name = 'Name is required.';
    if (!RollNumber) errors.RollNumber = 'Roll number is required.';
  
    if (!Gender) errors.Gender = 'Gender is required.';
    else if (!['Male', 'Female'].includes(Gender)) errors.Gender = 'Invalid gender.';
  
    if (!Course) errors.Course = 'Course is required.';
    else if (!BRANCHES[COURSES[Course]]) errors.Course = 'Invalid course selected.';
  
    if (!Branch) errors.Branch = 'Branch is required.';
    else if (Course && BRANCHES[COURSES[Course]] && !BRANCHES[COURSES[Course]].includes(Branch)) {
      errors.Branch = `Invalid branch for ${Course}.`;
    }
  
    if (!Year) errors.Year = 'Year is required.';
  
    if (!Category) errors.Category = 'Category is required.';
    else if (Gender && !(getCategoryOptions(Gender).includes(Category))) {
      errors.Category = `Invalid category for ${Gender}.`;
    }
  
    if (!RoomNumber) errors.RoomNumber = 'Room number is required.';
    else if (Gender && Category && ROOM_MAPPINGS[Gender]?.[Category] && !ROOM_MAPPINGS[Gender][Category].includes(String(RoomNumber))) {
      errors.RoomNumber = `Invalid room for ${Gender} - ${Category}.`;
    }
  
    if (!StudentPhone) errors.StudentPhone = 'Student phone is required.';
    else if (!/^[0-9]{10}$/.test(StudentPhone)) errors.StudentPhone = 'Must be 10 digits.';
  
    if (!ParentPhone) errors.ParentPhone = 'Parent phone is required.';
    else if (!/^[0-9]{10}$/.test(ParentPhone)) errors.ParentPhone = 'Must be 10 digits.';
  
    if (!Batch) errors.Batch = 'Batch is required.';
    else if (!/^\d{4}-\d{4}$/.test(Batch)) {
      errors.Batch = 'Format must be YYYY-YYYY.';
    } else {
      const [start, end] = Batch.split('-').map(Number);
      const duration = end - start;
      const expectedDuration = (Course === 'B.Tech' || Course === 'Pharmacy') ? 4 : 3;
      if (duration !== expectedDuration) {
        errors.Batch = `Duration must be ${expectedDuration} years for ${Course}.`;
      }
    }
  
    if (!AcademicYear) errors.AcademicYear = 'Academic year is required.';
    else if (!/^\d{4}-\d{4}$/.test(AcademicYear)) {
      errors.AcademicYear = 'Format must be YYYY-YYYY.';
    } else {
      const [start, end] = AcademicYear.split('-').map(Number);
      if (end !== start + 1) {
        errors.AcademicYear = 'Years must be consecutive.';
      }
    }
  
    return errors;
  };

  const handleClearTempStudents = async () => {
    if (!window.confirm('Are you sure you want to clear all temporary student records? This will remove all pending password reset students.')) {
      return;
    }
    
    try {
      const res = await api.delete('/api/admin/students/temp-clear');
      if (res.data.success) {
        toast.success(res.data.message);
        fetchTempStudentsSummary(); // Refresh the temp students list
      } else {
        toast.error(res.data.message || 'Failed to clear temporary students.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred while clearing temporary students.');
    }
  };

  const handleStartEdit = (index) => {
    setEditingRow(index);
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
  };

  const handleSaveEdit = (index) => {
    setEditingRow(null);
    toast.success('Changes saved to preview.');
  };

  const handleEditField = (index, field, value) => {
    const updatedData = [...editablePreviewData];
    const newStudent = { ...updatedData[index], [field]: value };
    updatedData[index] = newStudent;
    setEditablePreviewData(updatedData);

    const newErrors = [...previewErrors];
    newErrors[index] = validateStudentRow(newStudent);
    setPreviewErrors(newErrors);
  };

  const handleRemoveStudent = (index) => {
    const updatedData = editablePreviewData.filter((_, i) => i !== index);
    const updatedErrors = previewErrors.filter((_, i) => i !== index);
    setEditablePreviewData(updatedData);
    setPreviewErrors(updatedErrors);
    toast.success('Student removed from preview.');
  };

  // Function to generate PDF
  const generatePDF = () => {
    if (!bulkUploadResults) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Bulk Upload Results', 14, 15);
    
    // Add summary
    doc.setFontSize(12);
    doc.text(`Successfully Added: ${bulkUploadResults.successCount}`, 14, 25);
    doc.text(`Failed: ${bulkUploadResults.failureCount}`, 14, 30);

    // Add successful students table
    if (bulkUploadResults.addedStudents && bulkUploadResults.addedStudents.length > 0) {
      doc.setFontSize(14);
      doc.text('Successfully Added Students', 14, 40);

      const tableData = bulkUploadResults.addedStudents.map(student => [
        student.name,
        student.rollNumber,
        student.generatedPassword
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Name', 'Roll Number', 'Generated Password']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 10 }
      });
    }

    // Add errors table if any
    if (bulkUploadResults.errors && bulkUploadResults.errors.length > 0) {
      const lastY = doc.lastAutoTable.finalY || 45;
      doc.setFontSize(14);
      doc.text('Failed Entries', 14, lastY + 10);

      const errorData = bulkUploadResults.errors.map(error => [
        error.row,
        error.error,
        error.details ? JSON.stringify(error.details) : ''
      ]);

      autoTable(doc, {
        startY: lastY + 15,
        head: [['Row', 'Error', 'Details']],
        body: errorData,
        theme: 'grid',
        headStyles: { fillColor: [231, 76, 60] },
        styles: { fontSize: 8 }
      });
    }

    return doc;
  };

  // Function to handle PDF download
  const handleDownloadPDF = () => {
    const doc = generatePDF();
    if (doc) {
      doc.save('bulk-upload-results.pdf');
    }
  };

  // Function to handle printing
  const handlePrint = () => {
    const doc = generatePDF();
    if (doc) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  // Function to generate PDF for pending students
  const generatePendingStudentsPDF = () => {
    if (!tempStudentsSummary || tempStudentsSummary.length === 0) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Students Pending Password Reset', 14, 15);
    
    // Add summary
    doc.setFontSize(12);
    doc.text(`Total Students Pending: ${tempStudentsSummary.length}`, 14, 25);

    // Add students table
    const tableData = tempStudentsSummary.map(student => [
      student.name,
      student.rollNumber,
      student.generatedPassword,
      student.studentPhone,
      new Date(student.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Name', 'Roll Number', 'Generated Password', 'Phone', 'Added On']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10 }
    });

    return doc;
  };

  // Function to handle PDF download for pending students
  const handleDownloadPendingPDF = () => {
    const doc = generatePendingStudentsPDF();
    if (doc) {
      doc.save('pending-password-reset-students.pdf');
    }
  };

  // Function to handle printing for pending students
  const handlePrintPending = () => {
    const doc = generatePendingStudentsPDF();
    if (doc) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  const renderAddStudentForm = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-blue-800">Add New Student</h2>
      <form onSubmit={handleAddStudent} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
            <input
              type="text"
              name="rollNumber"
              value={form.rollNumber}
              onChange={handleFormChange}
              required
              pattern="[A-Z0-9]+"
              title="Uppercase letters and numbers only"
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleFormChange}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              name="course"
              value={form.course}
              onChange={handleFormChange}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Course</option>
              {Object.keys(COURSES).map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              name="year"
              value={form.year}
              onChange={handleFormChange}
              required
              disabled={!form.course}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Year</option>
              {form.course && Array.from(
                { length: COURSES[form.course] === 'BTECH' || COURSES[form.course] === 'PHARMACY' ? 4 : 3 },
                (_, i) => i + 1
              ).map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              name="branch"
              value={form.branch}
              onChange={handleFormChange}
              required
              disabled={!form.course}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Branch</option>
              {form.course && BRANCHES[COURSES[form.course]].map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleFormChange}
              required
              disabled={!form.gender}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Category</option>
              {form.gender && (form.gender === 'Male' 
                ? ['A+', 'A', 'B+', 'B'].map(category => (
                    <option key={category} value={category}>
                      {category === 'A+' ? 'A+ (AC)' : category === 'B+' ? 'B+ (AC)' : category}
                    </option>
                  ))
                : ['A+', 'A', 'B', 'C'].map(category => (
                    <option key={category} value={category}>
                      {category === 'A+' ? 'A+ (AC)' : category}
                    </option>
                  ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
            <select
              name="roomNumber"
              value={form.roomNumber}
              onChange={handleFormChange}
              required
              disabled={!form.gender || !form.category}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Room</option>
              {form.gender && form.category && ROOM_MAPPINGS[form.gender][form.category].map(room => (
                <option key={room} value={room}>Room {room}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Phone</label>
            <input
              type="tel"
              name="studentPhone"
              value={form.studentPhone}
              onChange={handleFormChange}
              required
              pattern="[0-9]{10}"
              title="10 digit phone number"
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
            <input
              type="tel"
              name="parentPhone"
              value={form.parentPhone}
              onChange={handleFormChange}
              required
              pattern="[0-9]{10}"
              title="10 digit phone number"
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                name="batch"
                value={form.batch}
                onChange={handleFormChange}
                required
                disabled={!form.course}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Batch</option>
                {form.course && generateBatches(form.course).map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <select
                name="academicYear"
                value={form.academicYear}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Academic Year</option>
                {generateAcademicYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={adding}
            className={`px-4 sm:px-6 py-2 rounded-lg text-white font-medium transition-all duration-200 text-sm sm:text-base ${
              adding 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
            }`}
          >
            {adding ? 'Adding...' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderStudentList = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      );
    }

    if (error && !tableLoading) {
      return <div className="text-center text-red-600 py-4">{error}</div>;
    }

    const countsByCourse = students.reduce((acc, student) => {
      acc[student.course] = (acc[student.course] || 0) + 1;
      return acc;
    }, {});

    const countsByBatch = students.reduce((acc, student) => {
      acc[student.batch] = (acc[student.batch] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">All Students</h2>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => setRenewalModalOpen(true)}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Renew Batches
              </button>
              <span className="text-sm text-gray-600">
                Showing {students.length} of {totalStudents} students
                {Object.entries(filters).some(([key, value]) => value && key !== 'search') && ' (filtered)'}
              </span>
            </div>
          </div>

          {/* Count Display - Made responsive */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Students by Course</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(countsByCourse).map(([course, count]) => (
                  <div key={course} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm text-gray-600 truncate">{course}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Students by Batch</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(countsByBatch).map(([batch, count]) => (
                  <div key={batch} className="flex justify-between items-center bg-white p-2 rounded">
                    <span className="text-sm text-gray-600 truncate">{batch}</span>
                    <span className="text-sm font-medium text-gray-900 ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters - Made responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or roll..."
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="w-full pl-9 sm:pl-10 pr-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                name="course"
                value={filters.course}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Courses</option>
                {Object.keys(COURSES).map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                name="branch"
                value={filters.branch}
                onChange={handleFilterChange}
                disabled={!filters.course}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Branches</option>
                {filters.course && BRANCHES[COURSES[filters.course]].map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                name="gender"
                value={filters.gender}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                disabled={!filters.gender}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {filters.gender && (filters.gender === 'Male' 
                  ? ['A+', 'A', 'B+', 'B'].map(category => (
                      <option key={category} value={category}>
                        {category === 'A+' ? 'A+ (AC)' : category === 'B+' ? 'B+ (AC)' : category}
                      </option>
                    ))
                  : ['A+', 'A', 'B', 'C'].map(category => (
                      <option key={category} value={category}>
                        {category === 'A+' ? 'A+ (AC)' : category}
                      </option>
                    ))
                )}
              </select>
            </div>
            <div>
              <select
                name="roomNumber"
                value={filters.roomNumber}
                onChange={handleFilterChange}
                disabled={!filters.gender || !filters.category}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Rooms</option>
                {filters.gender && filters.category && ROOM_MAPPINGS[filters.gender][filters.category].map(room => (
                  <option key={room} value={room}>Room {room}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                name="batch"
                value={filters.batch}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Batches</option>
                {filters.course && generateBatches(filters.course).map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
                {!filters.course && BATCHES.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                name="academicYear"
                value={filters.academicYear}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Academic Years</option>
                {generateAcademicYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters - Made responsive */}
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    course: '',
                    branch: '',
                    gender: '',
                    category: '',
                    roomNumber: '',
                    batch: '',
                    academicYear: ''
                  });
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (value && key !== 'search') {
                    return (
                      <span
                        key={key}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full flex items-center gap-1"
                      >
                        {key}: {value}
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, [key]: '' }));
                            setCurrentPage(1);
                          }}
                          className="ml-1 text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Table - Made responsive */}
        <div className="relative">
          {tableLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10 rounded-b-xl">
              <LoadingSpinner />
            </div>
          )}
          {error && !students.length && !tableLoading && (
            <div className="text-center text-red-600 py-10">{error}</div>
          )}
          {!error && !tableLoading && students.length === 0 && (
            <div className="text-center text-gray-500 py-10">No students found matching your criteria.</div>
          )}
          {(!tableLoading || students.length > 0) && students.length > 0 && (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                          <th scope="col" className="hidden sm:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                          <th scope="col" className="hidden md:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                          <th scope="col" className="hidden lg:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                          <th scope="col" className="hidden lg:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                          <th scope="col" className="hidden md:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th scope="col" className="hidden sm:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                          <th scope="col" className="hidden xl:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th scope="col" className="hidden lg:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                          <th scope="col" className="hidden lg:table-cell px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic Year</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {students.map(student => (
                          <tr key={student._id} className="hover:bg-gray-50">
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                            <td className="hidden sm:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
                            <td className="hidden md:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.course}</td>
                            <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">Year {student.year}</td>
                            <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.branch}</td>
                            <td className="hidden md:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.category === 'A+' ? 'A+ (AC)' : student.category === 'B+' ? 'B+ (AC)' : student.category}
                            </td>
                            <td className="hidden sm:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">Room {student.roomNumber}</td>
                            <td className="hidden xl:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.studentPhone}</td>
                            <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.batch}</td>
                            <td className="hidden lg:table-cell px-3 py-4 whitespace-nowrap text-sm text-gray-500">{student.academicYear}</td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => openEditModal(student)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <PencilSquareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(student._id)}
                                  disabled={deletingId === student._id}
                                  className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              {/* Pagination - Made responsive */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-6">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || tableLoading}
                    className="p-1.5 sm:p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || tableLoading}
                    className="p-1.5 sm:p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Password Modal
  const renderPasswordModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Student Added Successfully</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-yellow-800 font-medium">Generated Password:</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                toast.success('Password copied to clipboard!');
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </button>
          </div>
          <p className="text-2xl font-mono bg-yellow-100 p-2 rounded text-center select-all">{generatedPassword}</p>
          <p className="text-sm text-yellow-700 mt-2">
            Please save this password securely. It will be needed for the student's first login.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => {
              setShowPasswordModal(false);
              setGeneratedPassword(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Edit Modal
  const renderEditModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl p-3 sm:p-6 w-full max-w-2xl my-2 sm:my-4">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Edit Student</h2>
          <button
            onClick={() => setEditModal(false)}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Roll Number</label>
              <input
                type="text"
                value={editForm.rollNumber}
                disabled
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Gender</label>
              <select
                name="gender"
                value={editForm.gender}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Course</label>
              <select
                name="course"
                value={editForm.course}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Course</option>
                {Object.keys(COURSES).map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Year</label>
              <select
                name="year"
                value={editForm.year}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from(
                  { length: COURSES[editForm.course] === 'BTECH' || COURSES[editForm.course] === 'PHARMACY' ? 4 : 3 },
                  (_, i) => i + 1
                ).map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Branch</label>
              <select
                name="branch"
                value={editForm.branch}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Branch</option>
                {editForm.course && BRANCHES[COURSES[editForm.course]].map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Category</label>
              <select
                name="category"
                value={editForm.category}
                onChange={handleEditFormChange}
                required
                disabled={!editForm.gender}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Category</option>
                {editForm.gender && (editForm.gender === 'Male' 
                  ? ['A+', 'A', 'B+', 'B'].map(category => (
                      <option key={category} value={category}>
                        {category === 'A+' ? 'A+ (AC)' : category === 'B+' ? 'B+ (AC)' : category}
                      </option>
                    ))
                  : ['A+', 'A', 'B', 'C'].map(category => (
                      <option key={category} value={category}>
                        {category === 'A+' ? 'A+ (AC)' : category}
                      </option>
                    ))
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Room Number</label>
              <select
                name="roomNumber"
                value={editForm.roomNumber}
                onChange={handleEditFormChange}
                required
                disabled={!editForm.gender || !editForm.category}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Room</option>
                {editForm.gender && editForm.category && ROOM_MAPPINGS[editForm.gender][editForm.category].map(room => (
                  <option key={room} value={room}>Room {room}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Student Phone</label>
              <input
                type="tel"
                name="studentPhone"
                value={editForm.studentPhone}
                onChange={handleEditFormChange}
                required
                pattern="[0-9]{10}"
                title="10 digit phone number"
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Parent Phone</label>
              <input
                type="tel"
                name="parentPhone"
                value={editForm.parentPhone}
                onChange={handleEditFormChange}
                required
                pattern="[0-9]{10}"
                title="10 digit phone number"
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Batch</label>
              <select
                name="batch"
                value={editForm.batch}
                onChange={handleEditFormChange}
                required
                disabled={!editForm.course}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Batch</option>
                {editForm.course && generateBatches(editForm.course).map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">Academic Year</label>
              <select
                name="academicYear"
                value={editForm.academicYear}
                onChange={handleEditFormChange}
                required
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Academic Year</option>
                {generateAcademicYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-2 sm:pt-4">
            <button
              type="button"
              onClick={() => setEditModal(false)}
              className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editing}
              className={`w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-sm rounded-lg text-white font-medium transition-colors ${
                editing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {editing ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Update the bulk upload section
  const renderBulkUploadSection = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-50">
            <ArrowUpTrayIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Students</h2>
            <p className="text-sm text-gray-500">Upload multiple students using an Excel file</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - File Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ArrowUpTrayIcon className="w-8 h-8 mb-4 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">Excel file (.xlsx, .xls)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {bulkFile && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <DocumentArrowDownIcon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">{bulkFile.name}</span>
                </div>
                <button
                  onClick={() => setBulkFile(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            )}

            <button
              onClick={handleBulkUpload}
              disabled={!bulkFile || bulkProcessing}
              className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-all duration-200 ${
                !bulkFile || bulkProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {bulkProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" className="border-white" />
                  <span>Uploading...</span>
                </div>
              ) : (
                'Upload Students'
              )}
            </button>
          </div>

          {/* Right Column - Instructions */}
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-blue-800">Required Excel Columns:</h3>
                <a
                  href="/Updated_Student_Data.xlsx"
                  download
                  className="flex items-center px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
                  Download Sample
                </a>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Name (Student's full name)</li>
                <li>• RollNumber (Unique roll number)</li>
                <li>• Gender (Male/Female)</li>
                <li>• Course (B.Tech/Diploma/Pharmacy/Degree)</li>
                <li>• Branch (Based on course)</li>
                <li>• Year (1-4 for B.Tech/Pharmacy, 1-3 for others)</li>
                <li>• Category (A+/A/B+/B for Male, A+/A/B/C for Female)</li>
                <li>• RoomNumber (Based on gender and category)</li>
                <li>• StudentPhone (10-digit mobile number)</li>
                <li>• ParentPhone (10-digit mobile number)</li>
                <li>• Batch (Format based on course duration):
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>- B.Tech/Pharmacy: YYYY-YYYY (4 years, e.g., 2020-2024)</li>
                    <li>- Diploma/Degree: YYYY-YYYY (3 years, e.g., 2020-2023)</li>
                  </ul>
                </li>
                <li>• AcademicYear (e.g., 2023-2024)</li>
              </ul>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Batch Validation Rules:</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• B.Tech/Pharmacy batches must be 4 years (e.g., 2020-2024)</li>
                <li>• Diploma/Degree batches must be 3 years (e.g., 2020-2023)</li>
                <li>• Batch end year must match course duration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {showBulkPreview && bulkPreview && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Preview - Editable</h3>
          
          {/* Debug Information */}
          {bulkPreview.debug && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-md font-medium text-blue-800 mb-2">Debug Information</h4>
              <p className="text-sm text-blue-700">Total Rows: {bulkPreview.debug.totalRows}</p>
              <p className="text-sm text-blue-700">Available Columns: {bulkPreview.debug.firstRowColumns.join(', ')}</p>
              <details className="mt-2">
                <summary className="text-sm text-blue-700 cursor-pointer">First Row Data</summary>
                <pre className="text-xs text-blue-600 mt-1 bg-blue-100 p-2 rounded overflow-auto">
                  {JSON.stringify(bulkPreview.debug.firstRowData, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Editable Students Table */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-green-700">Students to Upload ({editablePreviewData.length})</h4>
              <div className="text-sm text-gray-500">
                Click on any cell to edit • Changes are saved automatically
              </div>
            </div>
            
            {editablePreviewData.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Row</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Name</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Roll Number</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Gender</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Course</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Branch</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Year</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Category</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Room</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Student Phone</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Parent Phone</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Batch</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Academic Year</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editablePreviewData.map((student, index) => {
                      const errors = previewErrors[index] || {};
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 font-medium align-top">
                            {index + 2}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="text"
                              value={student.Name || ''}
                              onChange={(e) => handleEditField(index, 'Name', e.target.value)}
                              title={errors.Name}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Name ? 'border-red-500' : 'border-gray-300'}`}
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="text"
                              value={student.RollNumber || ''}
                              onChange={(e) => handleEditField(index, 'RollNumber', e.target.value)}
                              title={errors.RollNumber}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.RollNumber ? 'border-red-500' : 'border-gray-300'}`}
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.Gender || ''}
                              onChange={(e) => handleEditField(index, 'Gender', e.target.value)}
                              title={errors.Gender}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Gender ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.Course || ''}
                              onChange={(e) => handleEditField(index, 'Course', e.target.value)}
                              title={errors.Course}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Course ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              <option value="B.Tech">B.Tech</option>
                              <option value="Diploma">Diploma</option>
                              <option value="Pharmacy">Pharmacy</option>
                              <option value="Degree">Degree</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.Branch || ''}
                              onChange={(e) => handleEditField(index, 'Branch', e.target.value)}
                              title={errors.Branch}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Branch ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              {student.Course && BRANCHES[COURSES[student.Course]]?.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.Year || ''}
                              onChange={(e) => handleEditField(index, 'Year', e.target.value)}
                              title={errors.Year}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Year ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              {student.Course && Array.from({ length: (student.Course === 'B.Tech' || student.Course === 'Pharmacy') ? 4 : 3 }, (_, i) => i + 1).map(year => (
                                <option key={year} value={year}>Year {year}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.Category || ''}
                              onChange={(e) => handleEditField(index, 'Category', e.target.value)}
                              title={errors.Category}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Category ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              {student.Gender && getCategoryOptions(student.Gender).map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <select
                              value={student.RoomNumber || ''}
                              onChange={(e) => handleEditField(index, 'RoomNumber', e.target.value)}
                              title={errors.RoomNumber}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.RoomNumber ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select</option>
                              {student.Gender && student.Category && ROOM_MAPPINGS[student.Gender]?.[student.Category]?.map(room => (
                                <option key={room} value={room}>Room {room}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="tel"
                              value={student.StudentPhone || ''}
                              onChange={(e) => handleEditField(index, 'StudentPhone', e.target.value)}
                              title={errors.StudentPhone}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.StudentPhone ? 'border-red-500' : 'border-gray-300'}`}
                              placeholder="10 digits"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="tel"
                              value={student.ParentPhone || ''}
                              onChange={(e) => handleEditField(index, 'ParentPhone', e.target.value)}
                              title={errors.ParentPhone}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.ParentPhone ? 'border-red-500' : 'border-gray-300'}`}
                              placeholder="10 digits"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="text"
                              value={student.Batch || ''}
                              onChange={(e) => handleEditField(index, 'Batch', e.target.value)}
                              title={errors.Batch}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.Batch ? 'border-red-500' : 'border-gray-300'}`}
                              placeholder="YYYY-YYYY"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <input
                              type="text"
                              value={student.AcademicYear || ''}
                              onChange={(e) => handleEditField(index, 'AcademicYear', e.target.value)}
                              title={errors.AcademicYear}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${errors.AcademicYear ? 'border-red-500' : 'border-gray-300'}`}
                              placeholder="YYYY-YYYY"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm align-top">
                            <button
                              onClick={() => handleRemoveStudent(index)}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                              title="Remove student"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-500">No valid students found in the file.</p>}
          </div>

          {/* Invalid Students */}
          {bulkPreview.invalidStudents && bulkPreview.invalidStudents.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium text-red-700 mb-2">Invalid Students ({bulkPreview.invalidStudents.length})</h4>
              <div className="max-h-80 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-red-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Row</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Roll Number</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bulkPreview.invalidStudents.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.row}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.data.Name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{item.data.RollNumber}</td>
                        <td className="px-4 py-2 text-sm text-red-600">
                          <ul className="list-disc list-inside">
                            {item.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleCancelPreview}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmBulkUpload}
              disabled={bulkProcessing || editablePreviewData.length === 0 || previewErrors.some(e => Object.keys(e).length > 0)}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${
                (bulkProcessing || editablePreviewData.length === 0 || previewErrors.some(e => Object.keys(e).length > 0))
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {bulkProcessing ? 'Uploading...' : `Confirm and Add ${editablePreviewData.length} Students`}
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {bulkUploadResults && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upload Results</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PrinterIcon className="w-4 h-4 mr-1.5" />
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">Successfully Added</h4>
              <p className="text-2xl font-bold text-green-600">{bulkUploadResults.successCount}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Failed</h4>
              <p className="text-2xl font-bold text-red-600">{bulkUploadResults.failureCount}</p>
            </div>
          </div>

          {bulkUploadResults.errors && bulkUploadResults.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Errors:</h4>
              <div className="max-h-60 overflow-y-auto">
                {bulkUploadResults.errors.map((error, index) => (
                  <div key={index} className="bg-red-50 p-3 rounded-lg mb-2">
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Row {error.row}:</span> {error.error}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Update the renderTempStudentsSummaryTable function
  const renderTempStudentsSummaryTable = () => (
    <div className="mt-8 bg-white rounded-xl shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-blue-800">Students Pending First Password Reset</h2>
          <p className="text-sm text-gray-600 mt-1">
            {tempStudentsSummary.length > 0 
             ? `${tempStudentsSummary.length} student(s) yet to reset their initial password.`
             : "All bulk-uploaded students have reset their passwords or no students are pending."}
          </p>
        </div>
        {tempStudentsSummary.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
            <button
              onClick={handleClearTempStudents}
              className="flex items-center px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              Clear Temp Students
            </button>
            <button
              onClick={handlePrintPending}
              className="flex items-center px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PrinterIcon className="w-5 h-5 mr-2" />
              Print List
            </button>
            <button
              onClick={handleDownloadPendingPDF}
              className="flex items-center px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
              Download PDF
            </button>
          </div>
        )}
      </div>
      
      {loadingTempSummary ? (
        <div className="flex justify-center items-center h-40"><LoadingSpinner /></div>
      ) : tempStudentsSummary.length === 0 ? (
        <p className="text-center text-gray-500 py-4">No students are currently pending password reset.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated Password</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added On</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tempStudentsSummary.map(student => (
                <tr key={student._id}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.name}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center justify-between">
                      <code className="px-2 py-1 bg-gray-100 rounded text-gray-800">{student.generatedPassword}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(student.generatedPassword);
                          toast.success('Password copied!');
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy password"
                      >
                        <DocumentDuplicateIcon className="w-5 h-5"/>
                      </button>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.studentPhone}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(student.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending Reset
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Batch Renewal Modal Component
  const BatchRenewalModal = ({ isOpen, onClose, onRenew }) => {
    const academicYears = generateAcademicYears();
    const [fromAcademicYear, setFromAcademicYear] = useState('');
    const [toAcademicYear, setToAcademicYear] = useState('');
    const [studentsToRenew, setStudentsToRenew] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [isRenewing, setIsRenewing] = useState(false);

    useEffect(() => {
      if (fromAcademicYear) {
        const fetchStudentsForRenewal = async () => {
          setLoadingStudents(true);
          try {
            const res = await api.get('/api/admin/students', {
              params: { academicYear: fromAcademicYear, limit: 1000 } // Fetch all for this year
            });
            if (res.data.success) {
              const activeStudents = res.data.data.students.filter(s => s.hostelStatus === 'Active');
              setStudentsToRenew(activeStudents);
              // Initially select all students
              setSelectedStudents(new Set(activeStudents.map(s => s._id)));
            } else {
              toast.error('Failed to fetch students for renewal.');
            }
          } catch (err) {
            toast.error(err.response?.data?.message || 'Error fetching students.');
          } finally {
            setLoadingStudents(false);
          }
        };
        fetchStudentsForRenewal();
      } else {
        setStudentsToRenew([]);
        setSelectedStudents(new Set());
      }
    }, [fromAcademicYear]);

    const handleSelectAll = (e) => {
      if (e.target.checked) {
        setSelectedStudents(new Set(studentsToRenew.map(s => s._id)));
      } else {
        setSelectedStudents(new Set());
      }
    };

    const handleSelectStudent = (studentId) => {
      const newSelection = new Set(selectedStudents);
      if (newSelection.has(studentId)) {
        newSelection.delete(studentId);
      } else {
        newSelection.add(studentId);
      }
      setSelectedStudents(newSelection);
    };

    const handleRenew = async () => {
      if (!fromAcademicYear || !toAcademicYear) {
        toast.error('Please select both "From" and "To" academic years.');
        return;
      }
      if (selectedStudents.size === 0) {
        if (!confirm('You have not selected any students to renew. This will mark all students from this year as inactive. Do you want to proceed?')) {
          return;
        }
      }
      setIsRenewing(true);
      try {
        await onRenew(fromAcademicYear, toAcademicYear, Array.from(selectedStudents));
        onClose();
      } finally {
        setIsRenewing(false);
      }
    };

    return (
      isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Renew Student Batches</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Academic Year</label>
                <select
                  value={fromAcademicYear}
                  onChange={(e) => setFromAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Year to Renew From</option>
                  {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To New Academic Year</label>
                <select
                  value={toAcademicYear}
                  onChange={(e) => setToAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select New Academic Year</option>
                  {academicYears.filter(y => y > fromAcademicYear).map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto border rounded-lg p-2 bg-gray-50">
              {loadingStudents ? (
                <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>
              ) : studentsToRenew.length > 0 ? (
                <div className="space-y-2">
                   <div className="flex items-center p-2 border-b">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedStudents.size === studentsToRenew.length}
                      onChange={handleSelectAll}
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-900">
                      Select All ({selectedStudents.size} / {studentsToRenew.length})
                    </label>
                  </div>
                  {studentsToRenew.map(student => (
                    <div key={student._id} className="flex items-center p-2 rounded-md hover:bg-gray-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedStudents.has(student._id)}
                        onChange={() => handleSelectStudent(student._id)}
                      />
                      <div className="ml-3 text-sm">
                        <label className="font-medium text-gray-900">{student.name}</label>
                        <p className="text-gray-500">{student.rollNumber} - {student.branch}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-10">
                  {fromAcademicYear ? 'No active students found for this year.' : 'Select an academic year to see students.'}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleRenew}
                disabled={isRenewing || loadingStudents || !fromAcademicYear || !toAcademicYear}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  (isRenewing || loadingStudents || !fromAcademicYear || !toAcademicYear)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRenewing ? 'Renewing...' : 'Renew Batches'}
              </button>
            </div>
          </div>
        </div>
      )
    );
  };

  // Function to handle the renewal API call
  const handleRenewBatches = async (fromAcademicYear, toAcademicYear, studentIds) => {
    try {
      const res = await api.post('/api/admin/students/renew-batch', { fromAcademicYear, toAcademicYear, studentIds });
      if (res.data.success) {
        toast.success(res.data.message);
        console.log('Renewal Results:', res.data.data);
        // Optionally refresh data
        if (tab === 'list') {
          fetchStudents(true);
        }
      } else {
        toast.error(res.data.message || 'Renewal failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred during batch renewal.');
    }
  };

  if (loading && tab === 'list' && !tableLoading) { 
    return <div className="p-4 sm:p-6 max-w-[1400px] mx-auto mt-16 sm:mt-0"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-[1400px] mx-auto mt-16 sm:mt-0">
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
        {TABS.map(t => (
          <button
            key={t.value}
            className={`flex items-center space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all duration-200 text-sm sm:text-base ${
              tab === t.value 
              ? 'bg-blue-600 text-white shadow-lg scale-105' 
              : 'bg-white text-gray-600 hover:bg-gray-50 shadow-md'
            }`}
            onClick={() => setTab(t.value)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'add' && renderAddStudentForm()}
      {tab === 'bulkUpload' && (
        <>
          {renderBulkUploadSection()}
          {renderTempStudentsSummaryTable()}
        </>
      )}
      {tab === 'list' && renderStudentList()}
      {showPasswordModal && renderPasswordModal()}
      {editModal && renderEditModal()}
      <BatchRenewalModal
        isOpen={renewalModalOpen}
        onClose={() => setRenewalModalOpen(false)}
        onRenew={handleRenewBatches}
      />
    </div>
  );
};

export default Students;