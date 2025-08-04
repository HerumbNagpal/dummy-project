//----------------------------------------Modules and dependencies
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors")
const app = express()


//--------------------------------------Connection to DataBase
mongoose.connect("mongodb://localhost:27017/bankUsers")
.then(()=> console.log("Connected to MongoDB"))
.catch(()=>console.log("Connection error : ", err))



//--------------------------------------User Account Schema Definition
const userSchema = new mongoose.Schema({
    firstName : {
        type : String,
        required : true
    },
    lastName : {
        type : String,
        required : true
    },
    mobile : {
        type : Number,
        required : true,
        unique : true
    },
    aadhaarCard : {
        type : Number,
        required : true,
        unique : true
    },
    accountBalance : {
        type : Number,
        required : true
    },
    uniqueID : {
        type : String,
        required : true
    }
})

const transactionSchema = new mongoose.Schema({
    uniqueID : {
        type : String,
        required : true
    },

    transactions : [
        {
            date : {
                type : Date,
                default : Date(Date.now())
            },
            desc : {
                type  : String,
                required : true
            },
            amount : {
                type : Number,
                required : true
            },
            balance : {
                type : Number,
                required : true
            }
        }
    ]

})


//--------------------------------------Model Creation
const User = mongoose.model("user",userSchema)
const Transaction = mongoose.model("statement", transactionSchema)


//--------------------------------------Port 
const PORT = 8080

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended : false}))





//--------------------------------------Routes

//---------------------------------------Fetching all bank accounts
app.get('/api/users',async(req,res)=> {
    const users = await User.find({})

    return res.json(users)
})


//---------------------------------------Fetching all bank accounts
app.get('/api/user',async(req,res)=> {
    const body = req.body
    
    const uniqueID = body.firstName + body.mobile

    const user = await User.findOne({uniqueID : uniqueID})

    if(!user){
        return res.json({message : "User does not exists"})
    }

    return res.json(user)
})




//---------------------------------------Adding New Account and adding a Transaction record
app.post('/api/newUser', async (req,res)=>{
    const body = req.body
    if(!body || !body.firstName || !body.lastName || !body.mobile || !body.aadhaarCard || !body.accountBalance) 
    {
        return res.status(401).json({Message : "Enter all fields"}) 
    }

    const uniqueID = body.firstName + body.mobile

    const newUser = await User.create({
        firstName : body.firstName,
        lastName : body.lastName,
        mobile : body.mobile,
        aadhaarCard : body.aadhaarCard,
        accountBalance : body.accountBalance,
        uniqueID : uniqueID
    })

    if(!newUser){
        return res.status(401).json({message : "Error"})
    }

    const newTransaction = await Transaction.create({
        uniqueID : uniqueID,
        transactions: [{
            desc: "Initial Deposit",
            amount: body.accountBalance,
            balance : body.accountBalance
        }]
    })

    return res.status(201).json({status : "User Added!", newUser})
})



//--------------------------------------Updating account Details
app.patch('/api/users', async(req,res)=> {
    const body = req.body

    if( !body.oldFirstName || !body.oldLastName || !body.oldMobile) 
    {
        return res.status(401).json({Message : "Enter all required fields"}) 
    }

    const oldUniqueID = body.oldFirstName + body.oldMobile
    const newUniqueID = (body.newFirstName?.trim() ? body.newFirstName : body.oldFirstName) + (body.newMobile?.trim() ? body.newMobile : body.oldMobile)

    const updateUser = await User.findOneAndUpdate(
        {uniqueID : oldUniqueID},
        {
            firstName: body.newFirstName?.trim() ? body.newFirstName : body.oldFirstName,
            lastName: body.newLastName?.trim() ? body.newLastName : body.oldLastName,
            mobile: body.newMobile?.trim() ? body.newMobile : body.oldMobile,
            uniqueID : newUniqueID
        },
        { new: true }
    )

    if (!updateUser) {
            return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User Updated!", updateUser });
})


//-------------------------------------Updating the bank balance and adding new transaction record
app.patch('/api/moneytransfer', async (req,res) => {
    const body = req.body

    const senderUniqueID = body.senderFirstName + body.senderMobile
    const receiverUniqueID = body.receiverFirstName + body.receiverMobile

    const sender = await User.findOne({uniqueID : senderUniqueID})
    const receiver = await User.findOne({ uniqueID: receiverUniqueID });

    if (!sender || !receiver) {
        return res.status(404).json({ message: "Sender or receiver not found" });
    }


    if(sender.accountBalance < body.amt){
        return res.json({message : "Insufficient Balance"})
    }

    
    
    const debited = await User.findOneAndUpdate(
        {uniqueID : senderUniqueID},
        {accountBalance : Number(sender.accountBalance) - Number(body.amt)},
        {new : true}
    )

    const credited = await User.findOneAndUpdate(
        {uniqueID : receiverUniqueID},
        {accountBalance : Number(receiver.accountBalance) + Number(body.amt)},
        {new : true}
    ) 


    const updateSenderTransactionHistory = await Transaction.findOneAndUpdate(
        {uniqueID : senderUniqueID},
        {
            $push : {
                transactions : {
                    desc : "Debit",
                    amount : body.amt,
                    balance : Number(sender.accountBalance) - Number(body.amt)
                }
            }
        },
        {new : true}
    )

    const updateReceiverTransactionHistory = await Transaction.findOneAndUpdate(
        {uniqueID : receiverUniqueID},
        {
            $push : {
                transactions : {
                    desc : "Credit",
                    amount : body.amt,
                    balance : Number(receiver.accountBalance) + Number(body.amt)
                }
            }
        },
        {new : true}
    )

    return res.send(`Hi ${sender.firstName}, your updated balance is ${debited.accountBalance}`)


})


//-------------------------------------Fetching all the transaction record
app.post('/api/user/transactionHistory', async (req,res) => {
    const body = req.body

    const uniqueID = body.firstName + body.mobile

    const user = await Transaction.findOne({uniqueID : uniqueID})

    if(!user){
        return res.json({message : "No user found"})
    }
    
    var sortedTransactions = [user.transactions]
    if(body.order === 'desc'){
             sortedTransactions = [...user.transactions].sort((a, b) => {
            return new Date(b.date) - new Date(a.date); 
        });
    }

    if(body.order === 'asc'){
             sortedTransactions = [...user.transactions].sort((a, b) => {
            return new Date(a.date) - new Date(b.date); 
        });
    }

    return res.json({transactions : sortedTransactions})

})


//-------------------------------------Performing ATM transactions
app.patch('/api/atm', async (req,res) => {
    const body = req.body

    const uniqueID = body.firstName + body.mobile

    const user = await User.findOne({uniqueID : uniqueID})

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }


    if(body.transactionType === "Withdraw" && user.accountBalance < body.amt){
        return res.json({message : "Insufficient Balance"})
    }

    else if(body.transactionType === "Withdraw" && user.accountBalance >= body.amt){
        
        const withdraw = await User.findOneAndUpdate(
            {uniqueID : uniqueID},
            {accountBalance : Number(user.accountBalance) - Number(body.amt)},
            {new : true}
        )

        const updateTransactionHistory = await Transaction.findOneAndUpdate(
        {uniqueID : uniqueID},
        {
            $push : {
                transactions : {
                    desc : "Withdrawn",
                    amount : body.amt,
                    balance : Number(user.accountBalance) - Number(body.amt)
                }
            }
        },
        {new : true}
        )

        return res.json({message : "Please take the reciept"})
    }

    else if(body.transactionType === "Deposit"){
        
        const deposit = await User.findOneAndUpdate(
            {uniqueID : uniqueID},
            {accountBalance : Number(user.accountBalance) + Number(body.amt)},
            {new : true}
        )

         const updateTransactionHistory = await Transaction.findOneAndUpdate(
            {uniqueID : uniqueID},
            {
                $push : {
                    transactions : {
                        desc : "Deposited",
                        amount : body.amt,
                        balance : Number(user.accountBalance) + Number(body.amt)
                    }
                }
            },
            {new : true}
        )

    }

    return res.send(`Hi ${user.firstName}, transaction successful`)


})




//--------------------------------------Activating the server
app.listen(PORT, ()=> console.log(`Server is up and running on PORT ${PORT}`))