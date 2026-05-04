import { format, parseISO } from 'date-fns';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy HH:mm');
};

export const formatPhone = (phone: string): string => {
  if (!phone) return '-';
  // Format Kenyan phone numbers
  if (phone.startsWith('+254')) {
    return phone.replace(/\+254(\d{3})(\d{3})(\d{3})/, '+254 $1 $2 $3');
  }
  if (phone.startsWith('0')) {
    return phone.replace(/0(\d{3})(\d{3})(\d{3})/, '0$1 $2 $3');
  }
  return phone;
};

export const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-red-100 text-red-800';
    case 'OVERALL_MANAGER':
      return 'bg-blue-100 text-blue-800';
    case 'BRANCH_MANAGER':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'APPROVED':
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'INACTIVE':
    case 'CANCELLED':
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'RETURNED':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'OVERALL_MANAGER':
      return 'Overall Manager';
    case 'BRANCH_MANAGER':
      return 'Branch Manager';
    default:
      return role;
  }
};

export const generateSaleCode = (): string => {
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${randomCode}-${year}`;
};

export const calculateTax = (amount: number, taxRate: number = 0): number => {
  return amount * (taxRate / 100);
};

export const calculateTotal = (subtotal: number, tax: number, discount: number = 0): number => {
  return subtotal + tax - discount;
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // Kenyan phone number validation
  const re = /^(\+254|0)[17]\d{8}$/;
  return re.test(phone);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const downloadCSV = (data: any[], filename: string) => {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape values with commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};
