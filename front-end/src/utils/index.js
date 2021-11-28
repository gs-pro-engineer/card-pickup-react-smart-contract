export const toReduced = (address, n=8) => `${address.slice(0, n)}...${address.slice(-1 * n)}`

