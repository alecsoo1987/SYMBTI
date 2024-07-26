//server.js에 api를 전부 열거하기엔 너무 많아서 shop 관련된 URL의 API만 따로 관리하는 파일

const router = require('express').Router()

let connectDB = require('../database.js')

let db;
connectDB.then((client)=>{
  db = client.db('SYMBTI')
}).catch((err)=>{
  console.log(err)
})

router.get('/sports', async (요청, 응답) => {
   await db.collection('SYMBTI').find().toArray()
   응답.send('스포츠 게시판')
})

router.get('/game', (요청, 응답) => {
   응답.send('게임 게시판')
})

module.exports = router 