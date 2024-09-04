const express = require('express')
const app = express()
const bcrypt = require('bcryptjs')
const { MongoClient, ObjectId } = require('mongodb') // ObjectId를 추가해야 게시물 ID값으로 리스팅 가능
require('dotenv').config()

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 },
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL,
    dbName: 'SYMBTI',
  })
}))

app.use(passport.session())

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'alecsoo1987',
    key: function (req, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

let connectDB = require('./database.js')

let db;
connectDB.then((client) => {
  db = client.db('SYMBTI')
}).catch((err) => {
  console.log(err)
})

/* 미들웨어 */
function loginCheck(req, res, next) {
  if (!req.user) {
    return res.send('로그인이 필요한 기능입니다.')
  }
  next()
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); // 인증된 사용자는 다음 미들웨어로 이동
  }
  res.redirect('/login'); // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
}


function nullCheck(req, res, next) {
  if (req.body.username == '' || req.body.password == '') {
    res.send('아이디 또는 비번이 입력되지 않았습니다.')
  } else {
    next()
  }
}

app.listen(8080, () => {
  console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('main.ejs', { loginedCheck: loginedCheck });
})

app.get('/home', async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('main.ejs', { loginedCheck: loginedCheck })
})



app.get('/theme/love/singleList/:num', loginCheck, async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  let num = parseInt(req.params.num);
  let selectedNum = null;
  let result = await db.collection('SYMBTI_Some').find().skip(num - 1).limit(1).toArray()
  if (result.length > 0) {
    let questionId = result[0]._id; // 여기서 _id를 추출합니다.
    let userId = req.user._id;
    let existingAnswer = await db.collection('answers').findOne({ questionId: new ObjectId(questionId), "participants.participants_id": new ObjectId(userId) });
    if (existingAnswer) {
      selectedNum = existingAnswer.participants[0].participants_answer;
    }
  }
  res.render('singleList.ejs', { DBList: result, num: num, selectedNum: selectedNum, loginedCheck: loginedCheck });
})

app.get('/theme/love/edit/:Id', async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  let result = await db.collection('SYMBTI_Some').findOne({ _id: new ObjectId(req.params.Id) })
  res.render('edit.ejs', { 바인딩: result, loginedCheck: loginedCheck })
})

app.post('/theme/love/edit', async (req, res) => {  
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  let id = req.body.id
  await db.collection('SYMBTI_Some').updateOne(
    { _id: new ObjectId(id) },
    {
      $set:
      {
        question: req.body.question,
        answer1: req.body.answer1,
        answer2: req.body.answer2,
        answer3: req.body.answer3,
        answer4: req.body.answer4
      }
    });
  res.redirect('/list', {loginedCheck: loginedCheck});
});

app.get('/theme/love/list/detail/:Id', async (req, res) => {
  let loginedCheck = false;  
  let result = await db.collection('SYMBTI_Some').findOne({ _id: new ObjectId(req.params.Id) })
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('detail.ejs', { 바인딩: result, loginedCheck : loginedCheck })
})

app.get('/theme/love/write', (req, res) => { //loginCheck 라는 미들웨어를 사용하여 로그인 상황을 체크
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('write.ejs',{loginedCheck: loginedCheck})
})

app.delete('/delete', async (req, res) => {
  let result = await db.collection('SYMBTI_Some').deleteOne({
    _id: new ObjectId(req.query.DBID),
    user: new ObjectId(req.user._id)
  })
  res.send('삭제완료')
})


app.post('/add_question', upload.single('upload_image'), async (req, res) => {
  if (req.body.question == '') {
    res.send('제목을 입력해주세요.')
  }
  try {
    await db.collection('SYMBTI_Some').insertOne({
      question: req.body.question,
      answer1: req.body.answer1,
      answer2: req.body.answer2,
      answer3: req.body.answer3,
      answer4: req.body.answer4,
      answer5: req.body.answer5,
      writerId: req.user._id,
      writerName: req.user.username
    })
    res.redirect('/list')

  } catch (e) {
    console.log(e)
    res.status(500).send('서버에러남')
  }
})

/* 로그인 관련 기능 */

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username: 입력한아이디 })
  if (!result) {
    return cb(null, false, { message: '존재하지 않는 ID입니다.' })
  }

  if (await bcrypt.compare(입력한비번, result.password)) {//입력한 비번과 result.password를 서로 비교해서 맞는지 확인해줌
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비밀번호가 일치하지 않습니다.' });
  }
}))

passport.serializeUser((user, done) => { //상단의 result (입력한 아이디)를 여기서 user로 받아서 사용
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async (user, done) => {
  let result = await db.collection('user').findOne({ _id: new ObjectId(user.id) })
  delete result.password
  process.nextTick(() => {
    done(null, result) // result에 req.user가 전송됨
  })
})

app.get('/login', nullCheck, async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('login.ejs', { loginedCheck: loginedCheck });
})

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return res.status(500).json(error)
    if (!user) return res.status(401).json(info.message)// passport.use에서 설정한 'message'를 불러옴
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(200).json({
        redirect: '/home'
      });
    });
  })(req, res, next)
})

app.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      console.error(err);
      return res.status(500).send('로그아웃 중 오류가 발생했습니다.');
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid'); // 세션 쿠키 삭제
      res.redirect('/home'); // 로그아웃 후 리디렉션할 페이지
    });
  });
});

/* 회원 가입 */
app.get('/register', async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  res.render('register.ejs', { loginedCheck: loginedCheck })
})

app.post('/register/check-id', async (req, res) => { // 버튼을 누르면 nullCheck부터 동작 후 req기능 수행
  let result = await db.collection('user').findOne({ username: req.body.username });
  if (result) {
    return res.status(400).json({ message: '중복 아이디입니다.' });
  }

  if (req.body.password !== req.body.confirmPassword) {
    return res.status(400).json({ message: '재확인 비밀번호가 일치하지 않습니다.' });
  }

  try {
    if (!req.body.password) {
      throw new Error('비밀번호가 전달되지 않았습니다.')
    }

    let 해시 = await bcrypt.hash(req.body.password, 10)

    await db.collection('user').insertOne({
      username: req.body.username,
      password: 해시,
      mbti: req.body.selectMBTI,
      createdAt: new Date(),
    })

    res.status(200).json({
      redirect: '/login',
      message: '회원가입을 축하합니다. 로그인 페이지로 이동합니다.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
})

app.post('/submitAnswer', loginCheck, async (req, res) => {
  let questionId = req.body.questionId;
  let question = req.body.question;
  let selectedAnswerNum = req.body.selectedAnswer;
  let selectedAnswerTxt = req.body.selectedAnswerText;
  let questionIdx = req.body.questionIdx;
  let userId = req.user._id;
  let mbti = req.user.mbti;
  let userName = req.user.username;

  try {
    //현재 질문이 이미 존재하는지, 현재 유저가 참여한 이력이 있는지 확인하는 변수
    let existingAnswer = await db.collection('answers').findOne({ questionId: new ObjectId(questionId), "participants.participants_id": new ObjectId(userId) });

    //예외사항 처리 함수
	if (existingAnswer) {

		function checkIfSameAnswer(existingAnswer, userId, selectedAnswerNum) {
		  if (!existingAnswer || !existingAnswer.participants) return false;
		  let participant = existingAnswer.participants.find(p => p.participants_id.equals(userId));
		  if (!participant) return false;
		  return participant.participants_answer === parseInt(selectedAnswerNum);
		}
		checkIfSameAnswer();
	} else {
		await db.collection('answers').insertOne({
			questionId: new ObjectId(questionId),
			questionTitle: question,
			participants: [
			  {
				participants_id: new ObjectId(userId),
				participants_answer: parseInt(selectedAnswerNum),
				participants_answertxt: selectedAnswerTxt,
				participants_mbti: mbti,
				participants_name: userName,
				createdAt: new Date(),
			  },
			],
		  });
	  
	} 
    // 리다이렉트 URL 설정
    let result_url = '/singleList/' + questionIdx + '/result/' + questionId;
    res.status(200).json({
      redirect: result_url
    })

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
})

app.get('/singleList/:num/result/:Id', async (req, res) => {
  let loginedCheck = false;
  if (req.isAuthenticated()) {
    loginedCheck = true;
  }
  let num = parseInt(req.params.num)
  let result = await db.collection('SYMBTI_Some').find().skip(num - 1).limit(1).toArray()
  let result2 = await db.collection('answers').find({
    questionId: new ObjectId(req.params.Id)
  }).toArray()
  res.render('singleListResult.ejs', { DBList: result, num: num, answerList: result2, loginedCheck: loginedCheck  })
})


/* 미사용 */

//Memo : 비활성화 기능, but 사용한다면 예외사항 처리해야함. (최소 2글자 이상, 검색결과 없을 경우 등)
app.get('/search', async (req, res) => {
  let searchItem = req.query.inputSearch
  let searchCondition = [
    {
      $search: {
        index: 'question_index',
        text: {
          query: searchItem,
          path: 'question'
        }
      }
    },
    {
      $limit: 1
    },
  ];
  let searchResults = await db.collection('SYMBTI_Some').aggregate(searchCondition).toArray();
  res.render('searchResult.ejs', { 바인딩: searchResults })
})

/* 삭제해도 됨 */
app.get('/theme/love/list', async (req, res) => {
  let result = await db.collection('SYMBTI_Some').find().toArray()
  res.render('list.ejs', { DBList: result })
})