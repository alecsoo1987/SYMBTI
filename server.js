const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
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
    key: function (요청, file, cb) {
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
function loginCheck(요청, 응답, next) {
  if (!요청.user) {
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
  if (요청.body.username == '' || 요청.body.password == '') {
    응답.send('아이디 또는 비번이 입력되지 않았습니다.')
  } else {
    next()
  }
}

// app.use(loginCheck)// 이 하단에 있는 모든 api의 미들웨어에 해당 함수를 동작 = 로그인 체크가 전역에서 발생
// app.use('/URL', loginCheck)// /URL 을 포함한 그 이하의 모든 주소에서 로그인 체크가 발생함

app.listen(8080, () => {
  console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', async (요청, 응답) => {
  응답.render('main.ejs')
})

app.get('/home', async (요청, 응답) => {
  응답.render('main.ejs')
})

/* 삭제해도 됨 */
app.get('/theme/love/list', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').find().toArray()
  응답.render('list.ejs', { DBList: result })
})

app.get('/theme/love/singleList/:num', loginCheck, async (요청, 응답) => {
  let num = parseInt(요청.params.num);
  let selectedNum = null;
  let result = await db.collection('SYMBTI_Some').find().skip(num - 1).limit(1).toArray()
  if (result.length > 0) {
    let questionId = result[0]._id; // 여기서 _id를 추출합니다.
    let userId = 요청.user._id;
    let existingAnswer = await db.collection('answers').findOne({ questionId: new ObjectId(questionId), "participants.participants_id": new ObjectId(userId) });
    if (existingAnswer) {
      selectedNum = existingAnswer.participants[0].participants_answer;
    }
  }
  응답.render('singleList.ejs', { DBList: result, num: num, selectedNum: selectedNum });
})

app.get('/theme/love/edit/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').findOne({ _id: new ObjectId(요청.params.Id) })
  응답.render('edit.ejs', { 바인딩: result })
})

app.post('/theme/love/edit', async (요청, 응답) => {
  let id = 요청.body.id
  await db.collection('SYMBTI_Some').updateOne(
    { _id: new ObjectId(id) },
    {
      $set:
      {
        question: 요청.body.question,
        answer1: 요청.body.answer1,
        answer2: 요청.body.answer2,
        answer3: 요청.body.answer3,
        answer4: 요청.body.answer4
      }
    });
  응답.redirect('/list');
});

app.get('/theme/love/list/detail/:Id', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').findOne({ _id: new ObjectId(요청.params.Id) })
  응답.render('detail.ejs', { 바인딩: result })
})

app.get('/theme/love/write', loginCheck, ensureAuthenticated, (요청, 응답) => { //loginCheck 라는 미들웨어를 사용하여 로그인 상황을 체크
  응답.render('write.ejs')
})

// app.get('/list/:Id', async (요청, 응답) => {
//   let result = await db.collection('SYMBTI_Some').findOne({ _id: new ObjectId(요청.params.Id) })
//   응답.render('list.ejs', { DBList: result })
// })

// app.get('/list/next/:Id', async (요청, 응답) => {
//   let result = await db.collection('SYMBTI_Some').find({ _id: { $gt: new ObjectId(요청.params.Id) } })
//   응답.render('list.ejs', { DBList: result })
// })

app.delete('/delete', async (요청, 응답) => {
  let result = await db.collection('SYMBTI_Some').deleteOne({
    _id: new ObjectId(요청.query.DBID),
    user: new ObjectId(요청.user._id)
  })
  응답.send('삭제완료')
})



app.post('/add_question', upload.single('upload_image'), async (요청, 응답) => {
  if (요청.body.question == '') {
    응답.send('제목안적었는데')
  }
  try {
    await db.collection('SYMBTI_Some').insertOne({
      question: 요청.body.question,
      answer1: 요청.body.answer1,
      answer2: 요청.body.answer2,
      answer3: 요청.body.answer3,
      answer4: 요청.body.answer4,
      answer5: 요청.body.answer5,
      img: 요청.file ? 요청.file.location : '',
      writerId: 요청.user._id,
      writerName: 요청.user.username
    })
    응답.redirect('/list')

  } catch (e) {
    console.log(e)
    응답.status(500).send('서버에러남')
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
    done(null, result) // result에 요청.user가 전송됨
  })
})

app.get('/login', nullCheck, async (요청, 응답) => {
  응답.render('login.ejs')
})

app.post('/login', (요청, 응답, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return 응답.status(500).json(error)
    if (!user) return 응답.status(401).json(info.message)// passport.use에서 설정한 'message'를 불러옴
    요청.login(user, (err) => {
      if (err) return next(err);
      응답.status(200).json({
        redirect: '/home'
      });
    });
  })(요청, 응답, next)
})

/* 회원 가입 */
app.get('/register', async (요청, 응답) => {
  응답.render('register.ejs')
})

app.post('/register/check-id', async (요청, 응답) => { // 버튼을 누르면 nullCheck부터 동작 후 요청기능 수행
  let result = await db.collection('user').findOne({ username: 요청.body.username });
  if (result) {
    return 응답.status(400).json({ message: '중복 아이디입니다.' });
  }

  if (요청.body.password !== 요청.body.confirmPassword) {
    return 응답.status(400).json({ message: '재확인 비밀번호가 일치하지 않습니다.' });
  }

  try {
    if (!요청.body.password) {
      throw new Error('비밀번호가 전달되지 않았습니다.')
    }

    let 해시 = await bcrypt.hash(요청.body.password, 10) // 암호를 여러번 꼰다는 의미로 정수 입력

    await db.collection('user').insertOne({
      username: 요청.body.username,
      password: 해시,
      mbti: 요청.body.selectMBTI,
      createdAt: new Date(),
    })

    응답.status(200).json({
      redirect: '/login',
      message: '회원가입을 축하합니다. 로그인 페이지로 이동합니다.'
    });

  } catch (error) {
    console.error(error);
    응답.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
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


//Memo : 비활성화 기능, but 사용한다면 예외사항 처리해야함. (최소 2글자 이상, 검색결과 없을 경우 등)
app.get('/search', async (요청, 응답) => {
  let searchItem = 요청.query.inputSearch
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
  응답.render('searchResult.ejs', { 바인딩: searchResults })
})


app.post('/submitAnswer', loginCheck, async (요청, 응답) => {
  let questionId = 요청.body.questionId;
  let question = 요청.body.question;
  let selectedAnswerNum = 요청.body.selectedAnswer;
  let selectedAnswerTxt = 요청.body.selectedAnswerText;
  let questionIdx = 요청.body.questionIdx;
  let userId = 요청.user._id;
  let mbti = 요청.user.mbti;
  let userName = 요청.user.username;

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

    /* 이미 존재할 경우 답변 유지/변경 시 토스트 메시지 (현재 모달이라 추후 개발 필요)
    if (existingAnswer) {
      if (!checkIfSameAnswer(existingAnswer, userId, selectedAnswerNum)) {
        eturn 응답.status(400).json({
          aleadyAnswer:  'You have already answered this question with the same answer.'
        })
        await db.collection('answers').updateOne({
          
        })
        return 응답.status(401).json({
          changeSelect : '기존 답변이 변경되었습니다.'
        })
      }
    }*/    
    // 리다이렉트 URL 설정
    let result_url = '/singleList/' + questionIdx + '/result/' + questionId;
    응답.status(200).json({
      redirect: result_url
    })

  } catch (error) {
    console.error(error);
    응답.status(500).send('Internal Server Error');
  }
})

app.get('/singleList/:num/result/:Id', async (요청, 응답) => {
  let num = parseInt(요청.params.num)
  let result = await db.collection('SYMBTI_Some').find().skip(num - 1).limit(1).toArray()
  let result2 = await db.collection('answers').find({
    questionId: new ObjectId(요청.params.Id)
  }).toArray()
  응답.render('singleListResult.ejs', { DBList: result, num: num, answerList: result2 })
})

app.get('/chat/request', async (요청, 응답) => {
  //let result = await db.collection('SYMBTI_Some').find().skip(num-1).limit(1).toArray()  
  응답.render('chat.ejs')
})