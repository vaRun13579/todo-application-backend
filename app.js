const express=require("express");
const cors=require("cors");
const path=require("path");
const {open}=require("sqlite");
const {v4:uuidv4} = require("uuid");
const sqlite3=require("sqlite3");
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken");
const app=express();
app.use(cors());
app.use(express.json());

const dbPath=path.join(__dirname,"todo.db");

let db=null;

const initilizeDatabaseServer=async function(){
    try{
        db=await open({
            filename:dbPath,
            driver:sqlite3.Database,
        });
        app.listen(5000,()=>{
            console.log("The Database has initilized successfully at http://localhost:5000/");
        })
    } catch(e){
        console.log("Unknown Error Occured ",e);
        process.exit(1);
    }
}

initilizeDatabaseServer().then(async()=>{
    // let a=await db.run(`CREATE TABLE IF NOT EXISTS users (
    //         id TEXT UNIQUE NOT NULL,
    //         name TEXT NOT NULL,
    //         username TEXT UNIQUE NOT NULL,
    //         email TEXT UNIQUE NOT NULL,
    //         password TEXT NOT NULL,
    //         gender TEXT NOT NULL,
    //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    //         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    //     );
    // `)
    // let b=await db.run(`CREATE TABLE IF NOT EXISTS tasks (
    //         id STRING PRIMARY KEY,
    //         user_id STRING NOT NULL,
    //         title TEXT NOT NULL,
    //         description TEXT,
    //         status TEXT NOT NULL CHECK (status IN ('done', 'pending', 'in progress', 'completed')),
    //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    //         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    //         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    //     );
    // `);
    const isThere= await db.get(`SELECT username FROM users WHERE username=='varun@123';`);
    const checkUserName= await db.get(`SELECT username FROM users where id='c6e92117-2140-45e2-a3c5-999b816b1aed';`);
    console.log("query results:",isThere, checkUserName);
    console.log("pass any query");
});

//middleware authentication function
const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.userId=payload.userId;
          next();
        }
      });
    }
};

// login function 
app.post("/login", async (request, response) => {
    console.log("request body for login:", request.body);
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    // console.log("database user:", dbUser);
    if (dbUser === undefined) {
      response.status(400);
      response.send({message:"Invalid User"});
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          userId: dbUser.id
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwt_token:jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });

  // SignUp function
  app.post("/register/", async (request, response) => {
    console.log("request body:", request.body);
    const { username, name, password, email, gender} = request.body;
    // console.log("username, password :", username, password);
    // console.log("body",request.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    // console.log("db user:", dbUser);
    if (dbUser === undefined) {
      const createUserQuery = `
        INSERT INTO 
          users (id,username, name, password, gender,email) 
        VALUES 
          (  
            '${uuidv4()}',
            '${username}', 
            '${name}',
            '${hashedPassword}', 
            '${gender}',
            '${email}'
          )`;
      try{
        const dbResponse = await db.run(createUserQuery);
        const newUserId = dbResponse.lastID;
        response.send({message:`Created new user, ${newUserId}`});
      } catch(er){
        response.status(400);
        response.send("You may not have entered the details like name, username, email, password.");
      }
    } else {
      response.status(400);
      response.send({message:"User already exists with this username change username and please try again."});
    }
});

// todo List function
app.get("/", authenticateToken, async (request, response)=>{
    const {userId}=request;
    // const {id:userId}=await db.get(`SELECT id FROM users WHERE username == '${username}';`);
    // console.log(userId, request.userId);
    const tasks=await db.all(`SELECT * FROM tasks WHERE user_id=='${userId}';`);
    // console.log(tasks);
    response.send(tasks);
})

// add task to todo list
app.post("/task/add/", authenticateToken, async (request, response)=>{
  const {userId}=request;
  const {title, description, status}=request.body;
  const query=`INSERT INTO tasks (id, user_id, title, description, status) 
    VALUES (
      '${uuidv4()}',
      '${userId}',
      '${title}',
      '${description}',
      '${status}'
    )`;
  try{
    const result=await db.run(query);
    console.log(result);
    response.send(result);
  } catch(e){
    console.log("error occured:",e.message);
    response.status(400);
    response.send(e);
  }
});

// get profile of user
app.get("/profile", authenticateToken, async (request, response)=>{
  const {userId}=request;
  const query = `SELECT * FROM users WHERE id='${userId}';`;
  const result= await db.get(query);
  delete result.password;
  console.log(result);
  response.send(result);
});

// edit a profile of user
app.put("/profile/edit/", authenticateToken, async (request, response)=>{
  const {userId}=request;
  const { username, name, email, gender} = request.body;
  const isThere= await db.get(`SELECT * FROM users WHERE username=='${username}';`);
  const checkUserName= await db.get(`SELECT username FROM users where id='${userId}';`);
  console.log("body:", request.body);
  const query= `UPDATE users 
    SET username = '${username}', name = '${name}', email = '${email}', gender = '${gender}', 
    updated_at = CURRENT_TIMESTAMP
    WHERE id=='${userId}';`;

  if (isThere!==undefined){
    if(isThere.username!==checkUserName.username){
      response.status(400);
      response.send({message:"User already Exists with this username."});
      return;
    }
  } 
  
  try{
    const result =await db.run(query);
    console.log(result);
    response.send(result);
  } catch(er){
    response.status=400;
    response.send(er);
  }
});

//delete a task of users.
app.delete("/task/:taskId/delete", authenticateToken, async (request, response)=>{
  const {taskId}=request.params;

  const query=`DELETE FROM tasks WHERE id='${taskId}';`;
  const result=await db.run(query);
  response.send(result);
  
});

// update a task of user.
app.put("/task/:taskId/edit", authenticateToken, async (request, response)=>{
  // const {userId}=request;
  const {taskId}=request.params;
  const {title, description, status}=request.body;
  console.log("edit request is:",taskId, request.body);

  const query=`UPDATE tasks
    SET title = '${title}', status = '${status}', description = '${description}', updated_at = CURRENT_TIMESTAMP
    WHERE id = '${taskId}';`;
  try{
    const result=await db.run(query);
    response.send(result);
  } catch(er){
    console.log(er.message);
    response.status=400;
    response.send(er);
  }
});