//mongoDB를 전체 영역에서 참조하기 위해 따로 빼는 과정

const { MongoClient } = require("mongodb"); 

const url = process.env.DB_URL;
let connectDB = new MongoClient(url).connect()

module.exports = connectDB
// 다른 곳에서 참조하기 위해서는 module.exports로 변수를 내보내야 하고, 가져올때는 require를 써야한다.
// vue의 export랑 비슷한 느낌