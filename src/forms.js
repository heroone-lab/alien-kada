// Stats for Arjun + the 10 aliens of the Kada
export const FORMS = {
  human: { name: 'ARJUN', title: 'Insaan', color: '#39ff6a', speed: 4.2, sprint: 7.8, jump: 7.5, gravity: 22, radius: 0.35, mass: 1, cam: [4.0, 1.55], armor: 1, power: null, powerName: 'Kada dabao aur alien bano!' },
  agni: { name: 'AGNI', title: 'Aag ka Yodha', color: '#ff5a1f', speed: 5.6, sprint: 10, jump: 9, gravity: 22, radius: 0.42, mass: 1.5, cam: [4.8, 1.9], armor: 0.7, power: 'fireball', cd: 0.3, powerName: 'Agni Gola – aag ke gole phenko' },
  vajra: { name: 'VAJRA', title: 'Chaar Haath Pehelwan', color: '#e53935', speed: 5.2, sprint: 9, jump: 12, gravity: 24, radius: 0.8, mass: 8, cam: [6.8, 2.8], armor: 0.4, power: 'slam', cd: 1.1, powerName: 'Dharti Tod – zameen pe ghoonsa (hawa me = ground pound)' },
  vega: { name: 'VEGA', title: 'Toofani Raftaar', color: '#18c8ff', speed: 9, sprint: 24, jump: 9, gravity: 24, radius: 0.4, mass: 1.2, cam: [4.8, 1.7], armor: 0.85, power: 'dash', cd: 0.7, powerName: 'Bijli Daud – super dash se sab uda do' },
  hima: { name: 'HIMA', title: 'Barf ka Heera', color: '#7fdcff', speed: 5.4, sprint: 9.5, jump: 9, gravity: 22, radius: 0.48, mass: 2, cam: [5.0, 2.0], armor: 0.6, power: 'ice', cd: 0.4, powerName: 'Hima Baan – barf ke teer, dushman jam jaye' },
  vidyut: { name: 'VIDYUT', title: 'Bijli Devta', color: '#ffe24a', speed: 6, sprint: 11, jump: 10, gravity: 22, radius: 0.42, mass: 1.2, cam: [4.8, 1.8], armor: 0.8, power: 'lightning', cd: 0.55, powerName: 'Chain Bijli – ek saath kai dushman' },
  garuda: { name: 'GARUDA', title: 'Aasmaan ka Raja', color: '#e0a526', speed: 6, sprint: 10.5, jump: 10, gravity: 22, radius: 0.5, mass: 1.5, cam: [5.8, 2.2], armor: 0.8, power: 'tornado', cd: 3, fly: true, powerName: 'Bavandar – toofan banao · Jump hold = udo' },
  pashan: { name: 'PASHAN', title: 'Pathar ka Pahad', color: '#8a8276', speed: 4.6, sprint: 8, jump: 9, gravity: 26, radius: 0.85, mass: 10, cam: [7.2, 3.0], armor: 0.3, power: 'boulder', cd: 0.9, powerName: 'Chattan Vaar – bhaari pathar phenko' },
  chhaya: { name: 'CHHAYA', title: 'Parchhai Bhoot', color: '#a070ff', speed: 5.8, sprint: 10, jump: 5, gravity: 9, radius: 0.42, mass: 0.5, cam: [5.2, 2.0], armor: 0.8, power: 'telekinesis', cd: 0.3, float: true, phase: true, powerName: 'Maya Pakad – cheez uthao, fir phenko · Jump hold = upar' },
  tarang: { name: 'TARANG', title: 'Dhwani Yoddha', color: '#35ffe0', speed: 6.4, sprint: 11, jump: 10, gravity: 22, radius: 0.36, mass: 1, cam: [4.2, 1.5], armor: 0.9, power: 'sonic', cd: 0.65, powerName: 'Dhwani Lehar – sonic blast' },
  anu: { name: 'ANU', title: 'Chhota Genius', color: '#9dff6a', speed: 4.2, sprint: 7.5, jump: 11, gravity: 22, radius: 0.22, mass: 0.2, cam: [2.8, 0.8], armor: 1, power: 'shrink', cd: 0.45, doubleJump: true, powerName: 'Anu Kiran – cheezon ko chhota/bada karo · double jump' },
};

export const ALIEN_ORDER = ['agni', 'vajra', 'vega', 'hima', 'vidyut', 'garuda', 'pashan', 'chhaya', 'tarang', 'anu'];
export const ALIEN_TIME = 60;
