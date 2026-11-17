// Precio mensual de cada bono en euros, según su número de clases.
// null = bono ilimitado. Si se añade un bono nuevo hay que darle precio aquí.
export const BONO_PRICES = new Map([
  [5, 40],
  [10, 45],
  [15, 50],
  [null, 55],
])

// Devuelve el precio de un bono o null si no tiene precio definido
export function bonoPrice(maxClasses) {
  const key = maxClasses ?? null
  return BONO_PRICES.has(key) ? BONO_PRICES.get(key) : null
}

export function formatEuros(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}
