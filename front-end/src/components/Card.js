import React from 'react'

export default ({id}) => {
  const card_style = {
    borderRadius: '5%',
  }
  
  const imageFileName = () => {
    return `${id}.png`
  }

  return (
    <div style={card_style}>
      <img src={`/cards/${imageFileName()}`} alt={imageFileName()} width="100" />
    </div>
  )
}
