// lib/validators.ts
// Validation functions สำหรับ เบอร์โทร, เลขบัญชี, ชื่อบัญชี

// ============================================
// PHONE NUMBER
// ============================================

/**
 * Validate เบอร์โทรไทย
 * - 10 หลัก
 * - ขึ้นต้นด้วย 0
 * - หลักที่ 2 เป็น 6, 8, 9 (มือถือ)
 */
export function validateThaiPhone(phone: string): { valid: boolean; error?: string; formatted?: string } {
  // ลบช่องว่าง และ -
  const cleaned = phone.replace(/[\s\-]/g, '')
  
  // เช็คความยาว
  if (cleaned.length !== 10) {
    return { valid: false, error: 'เบอร์โทรต้องมี 10 หลัก' }
  }
  
  // เช็คว่าเป็นตัวเลขทั้งหมด
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'เบอร์โทรต้องเป็นตัวเลขเท่านั้น' }
  }
  
  // เช็คขึ้นต้นด้วย 0
  if (!cleaned.startsWith('0')) {
    return { valid: false, error: 'เบอร์โทรต้องขึ้นต้นด้วย 0' }
  }
  
  // เช็คหลักที่ 2 (มือถือ: 06, 08, 09)
  const secondDigit = cleaned[1]
  if (!['6', '8', '9'].includes(secondDigit)) {
    return { valid: false, error: 'เบอร์มือถือต้องขึ้นต้นด้วย 06, 08 หรือ 09' }
  }
  
  return { valid: true, formatted: cleaned }
}

/**
 * แปลงเบอร์ไทยเป็น format +66
 * 0812345678 → +66812345678
 */
export function formatPhoneToE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-]/g, '')
  if (cleaned.startsWith('0')) {
    return '+66' + cleaned.slice(1)
  }
  if (cleaned.startsWith('+66')) {
    return cleaned
  }
  if (cleaned.startsWith('66')) {
    return '+' + cleaned
  }
  return '+66' + cleaned
}

/**
 * แปลงเบอร์ +66 กลับเป็น 0
 * +66812345678 → 0812345678
 */
export function formatPhoneToLocal(phone: string): string {
  if (phone.startsWith('+66')) {
    return '0' + phone.slice(3)
  }
  if (phone.startsWith('66')) {
    return '0' + phone.slice(2)
  }
  return phone
}

// ============================================
// BANK ACCOUNT
// ============================================

// ข้อมูลธนาคารไทย
export const THAI_BANKS = [
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', digits: [10] },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', digits: [10] },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', digits: [10] },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', digits: [10] },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', digits: [10] },
  { code: 'TMB', name: 'ธนาคารทหารไทยธนชาต', digits: [10, 12] },
  { code: 'GSB', name: 'ธนาคารออมสิน', digits: [12, 15] },
  { code: 'BAAC', name: 'ธนาคาร ธ.ก.ส.', digits: [12] },
  { code: 'CIMB', name: 'ธนาคาร ซีไอเอ็มบี', digits: [10] },
  { code: 'UOB', name: 'ธนาคารยูโอบี', digits: [10] },
  { code: 'LH', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', digits: [10] },
  { code: 'TISCO', name: 'ธนาคารทิสโก้', digits: [10] },
  { code: 'KK', name: 'ธนาคารเกียรตินาคินภัทร', digits: [10] },
  { code: 'ICBC', name: 'ธนาคารไอซีบีซี', digits: [10] },
] as const

export type BankCode = typeof THAI_BANKS[number]['code']

/**
 * Validate เลขบัญชีธนาคาร
 */
export function validateBankAccount(
  accountNumber: string, 
  bankCode?: string
): { valid: boolean; error?: string; formatted?: string } {
  // ลบช่องว่าง และ -
  const cleaned = accountNumber.replace(/[\s\-]/g, '')
  
  // เช็คว่าเป็นตัวเลขทั้งหมด
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'เลขบัญชีต้องเป็นตัวเลขเท่านั้น' }
  }
  
  // เช็คความยาวตามธนาคาร
  if (bankCode) {
    const bank = THAI_BANKS.find(b => b.code === bankCode)
    if (bank && !bank.digits.includes(cleaned.length)) {
      return { 
        valid: false, 
        error: `เลขบัญชี${bank.name}ต้องมี ${bank.digits.join(' หรือ ')} หลัก` 
      }
    }
  } else {
    // ถ้าไม่ระบุธนาคาร เช็คแค่ 10-15 หลัก
    if (cleaned.length < 10 || cleaned.length > 15) {
      return { valid: false, error: 'เลขบัญชีต้องมี 10-15 หลัก' }
    }
  }
  
  return { valid: true, formatted: cleaned }
}

// ============================================
// ACCOUNT NAME
// ============================================

/**
 * Validate ชื่อบัญชี
 * - ภาษาไทย หรือ อังกฤษ
 * - 2-100 ตัวอักษร
 * - มีช่องว่างได้
 */
export function validateAccountName(name: string): { valid: boolean; error?: string; formatted?: string } {
  const trimmed = name.trim()
  
  // เช็คความยาว
  if (trimmed.length < 2) {
    return { valid: false, error: 'ชื่อบัญชีต้องมีอย่างน้อย 2 ตัวอักษร' }
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'ชื่อบัญชีต้องไม่เกิน 100 ตัวอักษร' }
  }
  
  // เช็คว่าเป็นภาษาไทย/อังกฤษ/ช่องว่าง/จุด เท่านั้น
  // Thai: \u0E00-\u0E7F
  if (!/^[a-zA-Z\u0E00-\u0E7F\s.]+$/.test(trimmed)) {
    return { valid: false, error: 'ชื่อบัญชีต้องเป็นภาษาไทยหรืออังกฤษเท่านั้น' }
  }
  
  return { valid: true, formatted: trimmed }
}

// ============================================
// AMOUNT
// ============================================

/**
 * Validate จำนวนเงินถอน
 */
export function validateWithdrawAmount(
  amount: number, 
  balance: number,
  minAmount: number = 100 // ขั้นต่ำ 100 บาท
): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'จำนวนเงินไม่ถูกต้อง' }
  }
  
  if (amount < minAmount) {
    return { valid: false, error: `ถอนขั้นต่ำ ${minAmount} บาท` }
  }
  
  if (amount > balance) {
    return { valid: false, error: 'ยอดเงินไม่เพียงพอ' }
  }
  
  return { valid: true }
}