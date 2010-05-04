var Core = params.Core;
log = params.log;
//dictionary files
var dictPath = params.dictPath; //"/Data/database/system/PRSPlus/dictionary/"; //directory with dictionaries
var lineNo = 0; //a line number with the result of the last search
var lineLength = 30; //length of line when displaying definition
var xCol = 1; //starting position of the cursor - at the middle column
//Three button selection mode: if true, left arrow: left column, up arrow: up column, right arrow: right column
//otherwise: up arrow: previous term, left arrow - move cursor to left, right arrow - move cursor to the right
//target.threeButton = true;
var threeButton = false;
	
//map of special function keys
var keyMap = [
	['','CLR','BS'],
	['a','b','c'],
	['d','e','f'],
	['g','h','i'],
	['j','k','l'],
	['m','n','o'],
	['p','q','r'],
	['s','t','u'],
	['v','w','x'],
	['y','z',' ']
];



//return file's content in a string
var fileToString = function (path) {
	return Core.io.getFileContent(path, null);
};

//put text into /tmp/script.sh and run it
var runCommand = function (text) {
	Core.shell.exec(text);
};

//run a command and return the result
var runCommandResult = function (text) {
	var tmpf = "/tmp/__dict_result__";
	runCommand(text+" >"+tmpf);
	
	var res = fileToString(tmpf);
	this.issue=res;
	
	FileSystem.deleteFile(tmpf);
	return res;
};

//DICTIONARY FUNCTIONS

target.exitApp = function () {
	kbook.autoRunRoot.exitIf(kbook.model);
};

target.clearInput = function () {
	this.inputLine.setValue('');
};

target.clearStatus = function () {
	this.statusLine.setValue('');
};


target.clearLines = function () {
	this.printLines(['','','','','','','','','']);
};

//shows/hides hourglass
target.showHourGlass = function(show) {
	this.hourGlass.show(show);
	this.hourGlass.changeLayout(230,undefined, undefined, 300, undefined, undefined);
	FskUI.Window.update.call(kbook.model.container.getWindow());
};

//TODO: dynamic change of line font size according to # of lines in definition? (at least two sizes...)
target.printLines = function(aLines) {
	//all undefined lines will be cleared
	for(var i=0; i<9; i++) {
		if (!aLines[i]) {
			aLines[i]='';
		}
	}

	this.line1.setValue(aLines[0]);
	this.line2.setValue(aLines[1]);
	this.line3.setValue(aLines[2]);
	this.line4.setValue(aLines[3]);
	this.line5.setValue(aLines[4]);
	this.line6.setValue(aLines[5]);
	this.line7.setValue(aLines[6]);
	this.line8.setValue(aLines[7]);
	this.line9.setValue(aLines[8]);
};

//formats definition for Result area
var txtFormat = function(def) {
	var aLines = [];
	var strPos = 0;
	var arrIdx = 0;
	var spaceIdx = 0;
	
	while(strPos + lineLength < def.length) {
		spaceIdx = strPos + def.slice(strPos, strPos + lineLength).lastIndexOf(' '); //find the last space before line break
		aLines[arrIdx++] = def.slice(strPos, spaceIdx);
		strPos = spaceIdx+1;
	}
	aLines[arrIdx] = def.slice(strPos, def.length); //last line...
	return aLines;
};

//move cursor in columns (xCol: 0, 1 or 2)
target.arrowKey=function(button){
	if (button=="left"){
		if (threeButton) { 
			xCol = 0;
		} else {
			if (--xCol<0) {
				xCol = 2;
			}
		}
	}
	if (button=="right")	{
		if (threeButton) {
			xCol=2;
		} else {
			if (++xCol>2) {
				xCol = 0;
			}
		}
	}

	if (button=="up") {
		if (threeButton) {
			xCol = 1;
		} else {
			//lookup previous dict. line
			this.findNeighbour(-1);
		}
	}

	if(button=="down") {
		//lookup next dict. line
		this.findNeighbour(1);
	}
	
	this.lineCursor.changeLayout(457+xCol*48,undefined, undefined, 627, undefined, undefined);
};

//select a letter/function w/ function keys (key: 0..9)
target.pressDigit = function (digit) {
	var button = keyMap[digit][xCol];
	var processed = false; //has the key been processed? ('catch all letters')

	if (button === '') {
		return;
	}
	
	if (button=='BS') {
		//backspace
		var input = this.inputLine.getValue();
		this.inputLine.setValue(input.slice(0, input.length-1));
		processed = true;
	}

	if (button=='CLR') {
		//clear all text from inputLine
		processed = true;
		this.clearInput();
		this.clearLines();
	}

	if (!processed) {
		//letter
		this.inputLine.setValue(this.inputLine.getValue() + button);
	}
};


target.searchTerm = function(term) {
	this.showHourGlass(true);
	
	//I cannot access memory card from the shell (for the moment), so I have to have dictionary copied to internal memory
	var scriptLine = "/bin/grep -n -i '^" + term + "' " + dictPath + " | head -n 1";
	var res = runCommandResult(scriptLine);
	
	this.showHourGlass(false);
	if (res != '') {
		try {
			//get leading line number (separated by colon)
			var colonIdx = res.indexOf(':');
			lineNo = Number(res.slice(0, colonIdx));

			//get term (separated by two spaces)
			term = res.slice(colonIdx + 1, termIdx);

			//get defintion
			var definition = res.slice(termIdx + 2, res.length - 1);
			this.inputLine.setValue(term);
			this.printLines(txtFormat(definition));
			//TODO: store original searched term
		} catch(e) {
			var error = "Error searching for term: " + term + ": " + e;
			this.printLines(txtFormat(error));
		}
	} else {
		this.printLines(['Word not found', 'Please try again']);
	}
};

//perform a search or load a new dictionary:
target.centerKey = function () {
	var input = this.inputLine.getValue();
	
	if (input == '') {
		this.clearLines();
		this.line2.setValue('Please type some text');
		this.line3.setValue('before pressing Enter.');
		return;
	}
		
	this.searchTerm(this.inputLine.getValue());
};

//previous/next line. offset = distance from original line
target.findNeighbour = function (offset) {
	var newLineNo = lineNo + offset;
	
	var scriptLine = "/bin/sed -n '" + newLineNo + "p' "  + dictPath;
	var res = runCommandResult(scriptLine);

	if (res == '') {
		//before first or after last line
		this.statusLine.setValue('No line found - end of dictionary?');
		return;
	}
	
	lineNo = newLineNo;
	var termIdx = res.search('  ');
	//get term (separated by two spaces)
	var term = res.slice(0, termIdx);
	//get defintion
	var definition = res.slice(termIdx+2, res.length-1);
	this.inputLine.setValue(term);
	this.printLines(txtFormat(definition));
};