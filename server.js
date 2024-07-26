const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const { MongoClient,ObjectId } = require('mongodb') // ObjectId를 추가해야 게시물 ID값으로 리스팅 가능
require('dotenv').config()

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended : true}))

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 60 * 60 * 1000},
  store: MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName: 'SYMBTI',
  })
}))

app.use(passport.session()) 

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.S3_KEY,
      secretAccessKey : process.env.S3_SECRET,
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'alecsoo1987',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

let connectDB = require('./database.js')

let db;
connectDB.then((client)=>{
  db = client.db('SYMBTI')
}).catch((err)=>{
  console.log(err)
})

/* 미들웨어 Start*/
function loginCheck(요청, 응답, next){
  if(!요청.user) {
    return 응답.send('로그인이 필요한 기능입니다.')
  }
  next()
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); // 인증된 사용자는 다음 미들웨어로 이동
  }
  res.redirect('/login'); // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
}

function nullCheck(요청, 응답, next) {
  if(요청.body.username == '' || 요청.body.password == '') {
    응답.send ('아이디 또는 비번이 입력되지 않았습니다.')
  } else {
    next ()
  }
}

// app.use(loginCheck)// 이 하단에 있는 모든 api의 미들웨어에 해당 함수를 동작 = 로그인 체크가 전역에서 발생
// app.use('/URL', loginCheck)// /URL 을 포함한 그 이하의 모든 주소에서 로그인 체크가 발생함

app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').find().toArray()
  응답.render('list.ejs', { DBList : result})
}) 

app.get('/list', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').find().toArray()
  응답.render('list.ejs', { DBList : result})
}) 

app.get('/edit/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').findOne({ _id : new ObjectId(요청.params.Id)})
	응답.render('edit.ejs',{바인딩 : result})
}) 

app.get('/write', loginCheck, ensureAuthenticated,(요청, 응답) => { //loginCheck 라는 미들웨어를 사용하여 로그인 상황을 체크
  응답.render('write.ejs')
}) 

app.get('/list/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').findOne({ _id : new ObjectId(요청.params.Id)})
	응답.render('list.ejs',{DBList : result})
})

app.get('/list/next/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').find({ _id : {$gt : new ObjectId(요청.params.Id)}})
	응답.render('list.ejs',{DBList : result})
})

app.delete('/delete', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').deleteOne( { _id : new ObjectId(요청.query.DBID) } )
  응답.send('삭제완료')
})

app.get('list/1', async (요청, 응답) => {
  let result = await db.collection('post')
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
          answer4: 요청.nombody.answer4
        }
    });
  응답.redirect('/list/' + id);
});

app.post('/add',  async (요청, 응답) =>{
  
  upload.single('upload_image')(요청, 응답, (err) => {
    if(err) return 응답.send('업로드에러')
        // upload 미들웨어 사용. single 또는 array로 단수 다수 결정, 괄호 안에는 input의 name을 불러옴. 콤마 찍고 최대갯수 설정도 가능
  })


  try {
    if (요청.body.title == '') {
      응답.send('제목안적었는데')
    } else {
      await db.collection('SYMBTI_Some').insertOne({
        title : 요청.body.title,
        content : 요청.body.content,
        img : 요청.file.location // 등록한 이미지의 url
      })  
      응답.redirect('/add_Some')
    }
 } catch (e) {    
    console.log(e)
    응답.status(500).send('서버에러남')
 } 
})



/* 로그인 관련 기능 */

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }
  
  if (await bcrypt.compare(입력한비번, result.password)) {//입력한 비번과 result.password를 서로 비교해서 맞는지 확인해줌
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

passport.serializeUser((user, done) => { //상단의 result (입력한 아이디)를 여기서 user로 받아서 사용
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async (user, done) => {
  let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
  delete result.password
  process.nextTick(() => {
    done(null, result) // result에 요청.user가 전송됨
  })
})

app.get('/login', nullCheck, async (요청, 응답) => {
  응답.render('login.ejs')
}) 

app.post('/login', nullCheck, (요청, 응답, next) => {
  passport.authenticate('local',(error, user, info)=>{
    if (error) return 응답.status(500).json(error)
    if (!user) return 응답.status(401).json(info.message)// passport.use에서 설정한 'message'를 불러옴
    요청.login(user, (err)=>{
      if(err) return next(err)
        응답.redirect('/list')
    })
      
  }) (요청, 응답, next)
}) 

/* 회원 가입 */ 
app.get('/register', async (요청, 응답) => {  
  응답.render('register.ejs')
}) 

app.post('/register', nullCheck, async (요청, 응답)=> { // 버튼을 누르면 nullCheck부터 동작 후 요청기능 수행
  let result = await db.collection('user').findOne({ username: 요청.body.username });
  if (result) {
    return 응답.status(400).json({ message: '중복 아이디입니다.' });
  }

  if(요청.body.password !== 요청.body.confirmPassword) {
    return 응답.status(400).json({ message: '재확인 비밀번호가 일치하지 않습니다.' });
  }   

  let 해시 = await bcrypt.hash(요청.body.password, 10) // 암호를 여러번 꼰다는 의미로 정수 입력
  
  await db.collection('user').insertOne({
    username : 요청.body.username,
    password : 해시,
  })
  응답.redirect('/')
})

app.use('/shop', require('./routes/shop.js')) //routes/shop.js에 있는 겟 주소의 api를 전부 사용, / 또는 /shop처럼 중복되는 단어는 여기서 통합해서 사용할 수 있다.
app.use('/board/sub', loginCheck, require('./routes/sports.js'))
// boare/sub로 시작하는 페이지에 접속하면, loginCheck 미들웨어를 실행하고, next를 통해 routes/sports.js에 있는 api를 찾아서 실행한다.


/* index 없이 단어가 포함된 질문을 모두 검색 결과로 불러올 때 사용 

app.get('/search', async (요청,응답) => {
  let inputSearch = 요청.query.inputSearch
  let searchResults = await db.collection('SYMBTI_Some').find({
    $or: [
      { question: { $regex: inputSearch, $options: 'i' } },
      { answer1: { $regex: inputSearch, $options: 'i' } },   
      { answer2: { $regex: inputSearch, $options: 'i' } }, 
      { answer3: { $regex: inputSearch, $options: 'i' } }   
    ]
  }).toArray();

  let ids = searchResults.map(doc => doc._id);

  let result = await db.collection('SYMBTI_Some').find({
    _id: { $in: ids }
  }).toArray()
  
  응답.render('searchResult.ejs', {바인딩 : result})
}) */


app.get('/search', async (요청,응답) => {
  let searchItem = 요청.query.val;
  let searchCondition = [
    {$search : {
      index : 'question_index',
      text : { query : searchItem, path : 'question' }
    }}
  ]
  let searchResults = await db.collection('SYMBTI_Some').aggregate(searchCondition).toArray();
  
  응답.render('searchResult.ejs', {바인딩 : searchResults})
})