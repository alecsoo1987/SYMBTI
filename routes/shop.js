//server.js에 api를 전부 열거하기엔 너무 많아서 shop 관련된 URL의 API만 따로 관리하는 파일

const router = require('express').Router()

let connectDB = require('../database.js')

let db;
connectDB.then((client)=>{
  db = client.db('SYMBTI')
}).catch((err)=>{
  console.log(err)
})

router.get('/shirts', async (요청, 응답) => {
   let result = await db.collection('SYMBTI_Some').find().toArray()
   응답.render('test.ejs', {DBList: result})
})

router.get('/pants', (요청, 응답) => {
   응답.send('바지 파는 페이지입니다')
})

module.exports = router 