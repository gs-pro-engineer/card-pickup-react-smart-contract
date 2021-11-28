export const getTotalSupply = async (contract) => {
  try {
    const totalSupply = await contract.methods.totalSupply()
    return totalSupply
  } catch(e) {
    return '0'
  }
}

export const getAllowance = async (contract, owner, spender) => {
  try {
    const allowance = await contract.methods.allowance(owner, spender).call()
    return allowance
  } catch(e) {
    return '0'
  }
}

export const getTokenBalance = async (contract, address) => {
  try {
    const balance = await contract.methods.balanceOf(address).call()
    return balance
  } catch(e) {
    console.log('error in balanceOf', e)
    return '0'
  }
}

export const getLpBalance = async (contract) => {
  try {
    const balance = await contract.methods.getReserves().call()
    return balance
  } catch(e) {
    return ['0', '0']
  }
}
