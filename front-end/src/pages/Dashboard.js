import React, {useEffect, useState, useRef} from 'react'
import { useWallet } from '@binance-chain/bsc-use-wallet'
import Web3 from 'web3'
import BigNumber from 'bignumber.js'
import styled from 'styled-components'

import useRefresh from '../hooks/useRefresh'

import * as ERC20 from '../utils/erc20'
import TokenABI from '../data/abi/spadeq.json'
import BetTrackerABI from '../data/abi/betTracker.json'

import Card from '../components/Card'
import NoSpade from '../components/NoSpade'
import {toReduced} from '../utils'

const SPADEQ_ADDRESS = '0x52268253043b50d812aF6cCfc50d67De753D7638'
const BETTRACKER_ADDRESS = '0xc781854Da3898953942dDeBd11aCbeE8D30e6f7d'
const DEVELOPER_ACCOUNT = '0xA00dB5424da9ECFC26E0450200D42bab4652602d'

export default function Dashboard() {
  const wallet = useWallet()
  const ethereum = wallet.ethereum
  const account = wallet.account
  const refEth = useRef(ethereum)

  const [decimals, setDecimals] = useState(9)
  const [owner, setOwner] = useState()
  const [started, setStarted] = useState()
  const [balance, setBalance] = useState(0)
  const [allowance, setAllowance] = useState(0)
  const [betAmount, setBetAmount] = useState(0)
  const [rejectAmount, setRejectAmount] = useState(0)

  const [prize, setPrize] = useState(0)
  const [maxBets, setMaxBets] = useState(0)
  const [totalBets, setTotalBets] = useState(0)
  const [totalRejects, setTotalRejects] = useState(0)

  const [myBets, setMyBets] = useState(0)
  const [myRejects, setMyRejects] = useState(0)
  const [lastCard, setLastCard] = useState(0)
  const [winned, setWinned] = useState(false)

  const [betting, setBetting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const [web3, setWeb3] = useState(new Web3(ethereum))
  const [spadeQ, setSpadeQ] = useState()
  const [betTracker, setBetTracker] = useState()

  const { fastRefresh } = useRefresh()

  const toHex = (amount) => '0x' + amount.toString(16)

  useEffect(() => {
    if (ethereum !== refEth.current) {
      const _web3 = new Web3(ethereum)
      setWeb3(_web3)

      if (_web3) {
        const _spadeQ = new _web3.eth.Contract(TokenABI, SPADEQ_ADDRESS)
        const _betTracker = new _web3.eth.Contract(BetTrackerABI, BETTRACKER_ADDRESS)
        setSpadeQ(_spadeQ)
        setBetTracker(_betTracker)
      }
      refEth.current = ethereum
    }
  }, [ethereum])

  const fetchStatus = async () => {
    let _owner = await betTracker.methods.owner().call()
    setOwner(_owner.toLowerCase())

    let _started = await betTracker.methods.isStarted().call()
    setStarted(_started)

    let _decimals = await betTracker.methods.decimalsOfToken().call()
    setDecimals(_decimals)

    let _betAmount = await betTracker.methods.betAmount().call()
    setBetAmount(_betAmount)

    let _rejectAmount = await betTracker.methods.rejectAmount().call()
    setRejectAmount(_rejectAmount)

    let _allowance = await ERC20.getAllowance(spadeQ, account, BETTRACKER_ADDRESS)
    setAllowance(new BigNumber(_allowance).dividedBy(new BigNumber(10).pow(decimals)).toNumber())

    let _balanceOf = await ERC20.getTokenBalance(spadeQ, account)
    setBalance(new BigNumber(_balanceOf).dividedBy(new BigNumber(10).pow(decimals)).toNumber())

    let _prize = await ERC20.getTokenBalance(spadeQ, BETTRACKER_ADDRESS)
    setPrize(new BigNumber(_prize).dividedBy(new BigNumber(10).pow(decimals)).toNumber())

    let _maxBets = await betTracker.methods.maxBets().call()
    setMaxBets(_maxBets)

    let _totalBets = await betTracker.methods.totalBets().call()
    setTotalBets(_totalBets)

    let _totalRejects = await betTracker.methods.totalRejects().call()
    setTotalRejects(_totalRejects)

    let _myBests = await betTracker.methods.numberOfBets().call({from: account})
    setMyBets(_myBests)

    let _myRejects = await betTracker.methods.numberOfRejects().call({from: account})
    setMyRejects(_myRejects)

    let _winned = await betTracker.methods.winned().call({from: account})
    setWinned(_winned)

    if (!betting) {
      let _lastCard = await betTracker.methods.lastCard().call({from: account})
      console.log('last card: ', _lastCard)
      setLastCard(_lastCard)
    }

    // -------------------------------------------------------------------------------------------------------------
    // update configuration, and get status
    // -------------------------------------------------------------------------------------------------------------

    // await betTracker.methods.setToken(SPADEQ_ADDRESS, 9).send({from: account})
    // await betTracker.methods.setDeveloper(DEVELOPER_ACCOUNT).send({from: account})
    
    // await spadeQ.methods.setTracker(BETTRACKER_ADDRESS).send({from: account})
    // console.log('configuration finished.')

    // const tokenAddress = await betTracker.methods.token().call()
    // console.log('token address: ', tokenAddress)

    // const trackerAddress = await spadeQ.methods.tracker().call()
    // console.log('tracker address: ', trackerAddress)
  }

  useEffect(() => {
    if (wallet.status === 'connected') {
      fetchStatus()
    }
  }, [web3, account, fastRefresh])

  const resetStatus = () => {
    setOwner()

    setStarted()
    setBetAmount(0)
    setRejectAmount(0)

    setAllowance(0)
    setBalance(0)

    setPrize(0)
    setTotalBets(0)
    setTotalRejects(0)

    setMyBets(0)
    setMyRejects(0)
    setLastCard(0)
    setWinned(false)

    setBetting(false)
    setRejecting(false)
  }

  const onClickConnect = () => {
    if (wallet.status !== 'connected') {
      wallet.connect()
    } else {
      wallet.reset()

      resetStatus()
    }
  }

  const onClickStart = async () => {
    console.log('start betting')
    betTracker.methods.startBet().send({from: account})
      .then(() => {
        console.log('started')
      })
  }

  const onClickBet = async () => {
    try {
      // console.log('bet: ', allowance, betAmount, decimals, toHex(new BigNumber(balance).times(new BigNumber(10).pow(decimals))))
      if (allowance < betAmount) {
        spadeQ.methods.approve(BETTRACKER_ADDRESS, toHex(new BigNumber(balance).times(new BigNumber(10).pow(decimals)))).send({from: account})
          .then(() => {
            console.log('approved')
          })
        return
      }

      setLastCard(-1)
      setBetting(true)
      await betTracker.methods.bet().send({from: account})
      await fetchStatus()
      setBetting(false)
    } catch(e) {
      setBetting(false)
      console.log('error: ', e)
    }
  }

  const onClickReject = async () => {
    try {
      // console.log('reject: ', allowance, rejectAmount, decimals)
      if (allowance < rejectAmount) {
        spadeQ.methods.approve(BETTRACKER_ADDRESS, toHex(new BigNumber(balance).times(new BigNumber(10).pow(decimals)))).send({from: account})
          .then(() => {
            console.log('approved')
          })
        return
      }

      setRejecting(true)
      await betTracker.methods.reject().send({from: account})
      setRejecting(false)
    } catch(e) {
      setRejecting(false)
    }
  }

  return (
    <div className="container-fluid">
      <header className="d-flex justify-content-between pt-3 pb-1">
        <h3>SpadeQ</h3>

        <div>
          {
            ((wallet.status === 'connected') && account && account.toLowerCase() === owner) && !started && (
              <button className="btn btn-warning mr-2" onClick={onClickStart}>
                Start
              </button>
            )
          }

          <button className="btn btn-info" onClick={onClickConnect}>
            {wallet.status === 'connected' ? 'Disconnect' : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <div className="progress" style={{height: "3px"}}>
        <div className="progress-bar" role="progressbar" style={{width: `${totalBets * 100 / maxBets}%`}} aria-valuenow="25" aria-valuemin="0" aria-valuemax="100"></div>
      </div>

      <main>
        <div className="pt-1 d-flex flex-column align-items-center flex-md-row justify-content-between">
          <p className="my-1">Started: {started ? 'Yes' : 'No'}</p>
          <p className="my-1"><strong>My Balance: {balance}</strong></p>
          <p className="my-1">Bet Price: {betAmount}</p>
          <p className="my-1">Reject Price: {rejectAmount}</p>
          <p className="my-1">Bets: {totalBets} / {maxBets}</p>
          <p className="my-1">Rejects: {totalRejects}</p>
        </div>
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="mt-2 mt-md-5 mb-3 d-flex justify-content-center align-items-start">
              <h1>Prize: {prize}</h1>
              {
                winned>0 && 
                <span className="ml-2 badge badge-pill badge-danger">Win</span>
              }
            </div>
            <div className="row my-4 py-2">
              <div className="col-6 text-center">
                <p>My Bets: {myBets}</p>

                <div className="mt-4" style={{minHeight: '177px'}}>Last Card: 
                  {lastCard <= 0 || betting ? "-" : 
                    <Card id={lastCard} />
                  }
                </div>

              </div>

              <div className="col-6 text-center">
                <p>My Rejects: {myRejects}</p>

                <div className="mt-4" style={{minHeight: '177px'}}>
                  You guess? 
                  <NoSpade />
                </div>
              </div>
            </div>

            <div className="mt-4 row">
              <div className="col-6">
                {
                  (wallet.status === 'connected') && (
                    <div className="text-center">
                      <button className="btn btn-danger" style={{minWidth: '120px', width: '50%', margin: '0 auto'}} onClick={onClickBet} disabled={betting || !started || (balance < betAmount)}>Bet</button>
                      <div className="text-muted mt-3">
                        If you bet and <strong>SpadeQ</strong>, then you win!<br/>
                        If multiple winners, then you'll get dividend.
                      </div>
                    </div>
                  )
                }
              </div>

              <div className="col-6">
                {
                  (wallet.status === 'connected') && (
                    <div className="text-center">
                      <button className="btn btn-warning" style={{minWidth: '120px', width: '50%', margin: '0 auto'}} onClick={onClickReject} disabled={rejecting || !started || (balance < rejectAmount)}>Reject</button>
                      <div className="text-muted mt-3 text-center">
                        You guess no <strong>SpadeQ</strong> till the end?<br/>Then reject please.<br/>
                        If really no <strong>SpadeQ</strong>, then you win.
                      </div>
                    </div>
                  )
                }
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <div className="text-center my-2 d-md-none">
          Contract Address: &nbsp;
          <a href={`https://testnet.bscscan.com/address/${BETTRACKER_ADDRESS}`} target="_blank">
            {toReduced(BETTRACKER_ADDRESS)}
          </a>
        </div>

        <div className="text-center mt-5 mb-2 d-none d-md-block">
          Contract Address: &nbsp;
          <a href={`https://testnet.bscscan.com/address/${BETTRACKER_ADDRESS}`} target="_blank">
            {BETTRACKER_ADDRESS}
          </a>
        </div>
      </footer>
    </div>
  )
}
