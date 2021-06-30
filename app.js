var express = require("express");
var app = express();


app.set("view engine","ejs");
app.use(express.static('public'));
app.use("/", require("./routes"));


app.set("port", process.env.PORT || 3000);


app.listen(app.get("port"), function(){
	console.log("The Server Has Started!")
});