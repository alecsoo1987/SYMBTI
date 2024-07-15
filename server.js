const express = require('express')
const app = express()

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended : true}))


const { MongoClient,ObjectId } = require('mongodb') // ObjectId를 추가해야 게시물 ID값으로 리스팅 가능

let db
const url = 'mongodb+srv://admin:qwer1234@jeans.oiocggw.mongodb.net/?retryWrites=true&w=majority&appName=Jeans'
new MongoClient(url).connect().then((client)=>{
  console.log('DB연결성공')
  db = client.db('SYMBTI')
}).catch((err)=>{
  console.log(err)
})

app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', (요청, 응답) => {
  응답.sendFile(__dirname + '/index.html')
}) 

app.get('/list', async (요청, 응답) => { //Some 관련 문항 등록
  let result = await db.collection('SYMBTI_Some').find().toArray()
  응답.render('list.ejs', { DBList : result})
}) 

app.get('/edit/:Id', async (요청, 응답) => { //Some 관련 문항 등록
  let result = await db.collection('SYMBTI_Some').findOne({ _id : new ObjectId(요청.params.Id)})
	응답.render('edit.ejs',{바인딩 : result})
}) 
/*
app.get('/add_dailyLife', (요청, 응답) => { //일상 문항 등록
  db.collection('SYMBTI_dailyLife').insertOne({title : '타이틀'})
}) 

app.get('/add_Love', (요청, 응답) => { //연애 문항 등록
  db.collection('SYMBTI_Love').insertOne({title : '타이틀'})
})*/ 

app.get('/write', (요청, 응답) => { //연애 문항 등록
  응답.render('write.ejs')
}) 

app.get('/list/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').findOne({ _id : new ObjectId(요청.params.Id)})
	응답.render('list.ejs',{바인딩 : result})
})

app.delete('/delete', async (요청, 응답) => {
  let result = await db.collection('post').deleteOne( { _id : new ObjectId(요청.query.DBID) } )
  응답.send('삭제완료')
})

app.post('/edit', async (요청, 응답) => {
  let id = 요청.body.id
  await db.collection('SYMBTI_Some').updateOne(
      { _id: new ObjectId(id) },
      { $set: 
        { question : 요청.body.question, 
          answer1: 요청.body.answer1,
          answer2: 요청.body.answer2,
          answer3: 요청.body.answer3,
          answer4: 요청.body.answer4
        }
    });
  응답.redirect('/list/' + id);
});

app.post('/submit_question', async (요청, 응답) =>{ // form action이 add여서, add 요청이 오면 동작.
  if (요청.body.title == '') {
    응답.send('제목안적었는데')
  } else {
    await db.collection('SYMBTI_Some').insertOne({
      title : 요청.body.title,
      content : 요청.body.content
    })  
    응답.redirect('/add_Some')
  }

  try {
    if (요청.body.title == '') {
      응답.send('제목안적었는데')
    } else {
      await db.collection('SYMBTI_Some').insertOne({
        title : 요청.body.title,
        content : 요청.body.content
      })  
      응답.redirect('/add_Some')
    }
 } catch (e) {    
    console.log(e)
    응답.status(500).send('서버에러남')
 } 
})