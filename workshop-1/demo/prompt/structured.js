function isValidBDPhone(s) {
  if (typeof s !== 'string') return false;
  return /^(?:01[3-9]\d{8}|8801[3-9]\d{8}|\+8801[3-9]\d{8})$/.test(s);
}
