var params = window.location.search.substring(1).split("&");
for (var i = 0; i < params.length; ++i) {
    var pair = params[i].split("=");
    if (pair[0] === "url")
    	document.getElementById("mywebview").setAttribute("src", pair[1]);
}
