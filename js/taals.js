// Theka data. marks: X = sam, 0 = khali, digits = tali.
export const TAALS = [
  { id: 'teentaal', name: 'Teentaal (16)', bols: ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'], vibhags: [4, 4, 4, 4], marks: ['X', '2', '0', '3'] },
  { id: 'keherwa', name: 'Keherwa (8)', bols: ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ka', 'Dhi', 'Na'], vibhags: [4, 4], marks: ['X', '0'] },
  { id: 'dadra', name: 'Dadra (6)', bols: ['Dha', 'Dhi', 'Na', 'Dha', 'Tu', 'Na'], vibhags: [3, 3], marks: ['X', '0'] },
  { id: 'rupak', name: 'Rupak (7)', bols: ['Tin', 'Tin', 'Na', 'Dhin', 'Na', 'Dhin', 'Na'], vibhags: [3, 2, 2], marks: ['0', '2', '3'] },
  { id: 'jhaptaal', name: 'Jhaptaal (10)', bols: ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Tin', 'Na', 'Dhi', 'Dhi', 'Na'], vibhags: [2, 3, 2, 3], marks: ['X', '2', '0', '3'] },
  { id: 'ektaal', name: 'Ektaal (12)', bols: ['Dhin', 'Dhin', 'Dhage', 'Tirkit', 'Tu', 'Na', 'Kat', 'Ta', 'Dhage', 'Tirkit', 'Dhin', 'Na'], vibhags: [2, 2, 2, 2, 2, 2], marks: ['X', '0', '2', '0', '3', '4'] },
];

// Returns, per matra, the index of its vibhag and whether it starts one.
export function matraMeta(taal) {
  const out = [];
  let v = 0, inV = 0;
  for (let i = 0; i < taal.bols.length; i++) {
    out.push({ vibhag: v, startsVibhag: inV === 0, mark: inV === 0 ? taal.marks[v] : '' });
    inV++;
    if (inV >= taal.vibhags[v]) { v++; inV = 0; }
  }
  return out;
}
