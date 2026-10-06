// Definición centralizada de categorías para Alfa Materiales
export const CATEGORIAS = [
  { 
    id: "combos", 
    nombre: "Combos", 
    nombreCorto: "Combos", 
    badgeClase: "badge-combos",
    orden: 1
  },
  { 
    id: "ladrillos", 
    nombre: "Ladrillos", 
    nombreCorto: "Ladrillos", 
    badgeClase: "badge-ladrillos",
    orden: 2
  },
  { 
    id: "aridos", 
    nombre: "Áridos y Aglomerantes", 
    nombreCorto: "Áridos", 
    badgeClase: "badge-aridos",
    orden: 3
  },
  { 
    id: "otros", 
    nombre: "Otros", 
    nombreCorto: "Otros", 
    badgeClase: "badge-otros",
    orden: 4
  }
];

export const MAPA_CATEGORIAS = Object.fromEntries(
  CATEGORIAS.map(cat => [cat.id, cat])
);

export const ORDEN_CATEGORIAS = Object.fromEntries(
  CATEGORIAS.map((cat, idx) => [cat.id, idx])
);
