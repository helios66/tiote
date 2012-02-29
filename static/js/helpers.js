/* Navigation.js Copyright (c) 2010 Jay Carlson */
var Navigation = new Class({
	Implements: [Options, Events],
	options: {
		interval: 200
		
	},
	state: null,
	oldLocation: "",
	initialize: function(options) {
		this.setOptions(options);
		this.state = new Hash();
		if("onhashchange" in window) {
			window.onhashchange = this.agent.bind(this);
			this.agent();
		} else {
			var navigationChangeTimer = setInterval(this.agent.bind(this), this.options.interval);
		}
	},
	
	agent: function() {
		if(this.oldLocation.length < 1 || this.oldLocation != window.location.hash.substr(1, window.location.hash.length-1)) { //only update if the location changed
			this.oldLocation = window.location.hash.substr(1, window.location.hash.length-1);
			this.state.empty();
			this.state.extend(this.oldLocation.parseQueryString(false, true));
			this.fireEvent("navigationChanged", this.state);
		}	
	},
	updateLocation: function() {
		window.location.hash = this.state.toQueryString().cleanQueryString();	
	},
	set: function(key, value) {
		if(typeOf(key) != "string" && value == null) {
			this.state.extend(key);
		} else {
			this.state.set(key, value);
		}
		this.updateLocation();
	},
	unset: function(keys) {
		if(typeOf(keys)=="string") {
			this.state.erase(keys);
		} else {
			keys.each(function(item) {
				this.state.erase(item);
			}.bind(this));	
		}
		this.updateLocation();
	},
	clearAndSet: function(key, value) {
		this.state.empty();
		this.set(key, value);
	}
});


function serializeForm(context){
	var form_data = new Object();
	// input[type=text]
	$$('#' + context +' input[type=text]').each(function(item,key){
		form_data[item.get('name')] = item.get('value');
	});
	// hidden input
	$$('#'+context+' input[type=hidden]').each(function(item){
		form_data[item.name] = item.value;
	});
	// input[type=password]
	$$('#' + context +' input[type=password]').each(function(item, key){
		form_data[item.get('name')] = item.get('value');
	});
	// input[type=radio]
	$$('#' + context + ' input[type=radio]').each(function(item, key){
		if (item.checked)
			form_data[item.name] = item.value;
	});
	// input[type=checkbox]
	$$('#' + context + ' input[type=checkbox]').each(function(item,key){
		if ( ! form_data.has(item.name) ) 
			form_data[item.name] = [];
		if (item.checked) {
			ar = form_data[item.name];
			form_data[item.name][ar.length] = item.value;
		}
	});
	// select
	$$('#' + context + ' select').each(function(item,key){
		form_data[item.name] = item.value;
	})
	return form_data;
}

function generate_ajax_url(withAjaxKey,extra_data) {
	extra_data = extra_data || {};
	withAjaxKey = withAjaxKey || false;
	var n = new Hash( page_hash() );
	n.extend(extra_data);
	var request_url = 'ajax/?';
	n.each(function(item,key){
		if (key == 'section') {
			request_url += key + '=' + item;
		}
		else {
			request_url += '&' + key + '=' + item;
		}
	})
	if (withAjaxKey) request_url += '&ajaxKey=' + ajaxKey;
	return request_url
}


function make_checkable(data_table) {
	// select a tr element or a range of tr elements when the shift key is pressed
	selected_tr = ''
	$$('input.checker').addEvent('click', function(e) {
		last_selected_tr = selected_tr || '';
		var id =  e.target.getProperty('id');
		id = id.replace('check', 'row'); // id of equivalent <tr>
		selected_tr = $(id)
		if (e.shift && typeof(last_selected_tr == 'element')){
			var checker_status;
			if (data_table.isSelected(last_selected_tr)) {
				data_table.selectRange(last_selected_tr, selected_tr);
				checker_status = true;
			}else if (data_table.isSelected(selected_tr)) {
				data_table.deselectRange(last_selected_tr, selected_tr);
				checker_status = false;
			}
			// (un)check the checkboxes
			var start_i;var end_i;
			var sel_tr_index = parseInt(id.split('_')[1])
			var last_sel_tr_index = parseInt(last_selected_tr.id.split('_')[1])
			if (sel_tr_index > last_sel_tr_index) {
				start_i = last_sel_tr_index;
				end_i = sel_tr_index;
			} else {
				start_i = sel_tr_index;
				end_i = last_sel_tr_index;
			}
			for (var j = start_i; j < (end_i + 1); j++){
				$('check_'+String(j)).setProperty('checked', checker_status);
			}
		} else {
			data_table.toggleRow(e.target.getParent('tr'));
		}		

	});
}


// for selecting and deselecting all the trs of a table
// state = true : ticks all checkboxes and selects all rows
// state = false : unticks all checkboxes and deselects all rows
function set_all_tr_state(context, state) {
	state ? context.selectAll() : context.selectNone();
	for (var i=0; i < $(context).getElements('tbody tr').length; i++) {
		$('check_'+i).setProperty('checked', state);
	}
}



function runXHRJavascript(){
	console.log('runXHRJavaxript() called!');
	var scripts = $ES("script", 'rightside');
	for (var i=0; i<scripts.length; i++) {
		// basic xss prevention
		if (scripts[i].get("ajaxKey") == ajaxKey) {
			var toRun = scripts[i].get('html');
			var newScript = new Element("script");
			newScript.set("type", "text/javascript");
			if (!Browser.ie) {
				newScript.innerHTML = toRun;
			} else {
				newScript.text = toRun;
			}
			document.body.appendChild(newScript);
			document.body.removeChild(newScript);
		}
	}
}

function f(g) {
	if (g == undefined || g == "undefined" || g == null)
		return "";
	else
		return g;
}

var $E = function(selector, filter) {
	return ($(filter) || document).getElement(selector);
};

var $ES = function(selector, filter) {
	return ($(filter) || document).getElements(selector);
};

function redirectPage(context){
	location.hash = '#' + Object.toQueryString(context);
}

function reloadPage(){
	var context = new Hash();
	context.extend(location.hash.replace("#",'').parseQueryString(false, true));
	nav.state.empty();
	nav.set(context);
	nav.fireEvent('navigationChanged', context);
}

// hack: avoiding bind of a Request callback
var updateAssets = function(obj, bool){
	bool = false || Boolean(bool);
	assets.extend(obj);
	if (bool) {
		assets['xhrCount'] += 1;
		assets['xhrData_' + assets['xhrCount']] = assets['xhrData'];
		assets['xhr_last'] = assets['xhrData_' + assets['xhrCount']];
		assets.erase('xhrData')
	}
	
}

function showDialog(title, msg, options){
	var op = {
		'offsetTop': 0.2 * screen.availHeight
		}
	if (options) op = Object.merge(op, options)
	var SM = new SimpleModal(op);
	SM.show({
		'title': title, 
		'contents': msg
	})
}


function checkLoginState(){
	return shortXHR({
		'loginCheck': 'yeah'
	})
}

// add a class of select to the current displayed menu
function setTopMenuSelect(){
	var aas = $$('.nav')[0].getElements('a');
	aas.each(function(item){
		if (location.href.contains(item.hash)){
			item.getParent().addClass('active');
			item.setStyle('font-weight', 'bold');
		}
	});
}


function getWindowWidth() {
	if (window.innerWidth)
		return window.innerWidth;
	else
		return document.documentElement.clientWidth;
}

function getWindowHeight() {
	if (window.innerHeight)
		return window.innerHeight;
	else
		return document.documentElement.clientHeight;
}

function tbl_pagination(total_count, limit, offset) {
	var pag_max = Math.floor(total_count / limit);
	var pag_lnks = new Elements();
	for ( i = 0; i < (pag_max + 1); i++) {
		var navObj = location.hash.parseQueryString(false, true);
		navObj['offset'] = String(i*limit);
		var request_url = location.protocol+'//'+location.host+location.pathname+Object.toQueryString(navObj);
		pag_lnks.include( new Element('a',{
			'href': request_url, 
			'class':'pag_lnk', 
			'text':(i+1)
			})
		);
	}
	var ancs = new Elements();
	var j = Math.floor(offset/limit);
	if ( pag_max > 0 ) {
		if (j == 0) {
			ancs.append( [ pag_lnks[0].addClass('active'),
				(pag_max > 2) ? pag_lnks[1] : pag_lnks[1].addClass('last'),
				(pag_max > 2) ? pag_lnks[2].addClass('last') : null, 
				pag_lnks[1].clone().set('text','Next').addClass('cntrl').removeClass('last'),
				pag_lnks[pag_max].clone().set('text', 'Last').addClass('cntrl')
				]);
				
		} else if (j == pag_max) {
			ancs.append( [ pag_lnks[0].clone().set('text','First').addClass('cntrl'), 
				pag_lnks[j-1].clone().set('text','Prev').addClass('cntrl last'),
				pag_lnks[j-1], pag_lnks[j].addClass('active') 
				]);
		} else {
			ancs.append( [ pag_lnks[0].clone().set('text','First').addClass('cntrl').removeClass('last'),
				pag_lnks[j-1].clone().set('text','Prev').addClass('cntrl last'),
				pag_lnks[j-1], pag_lnks[j].addClass('active'), pag_lnks[j+1].addClass('last'),
				pag_lnks[j+1].clone().set('text','Next').addClass('cntrl').removeClass('last'),
				pag_lnks[pag_max].clone().set('text', 'Last').addClass('cntrl').removeClass('last')
				] );
		}
	}
	
	return new Element('p', {'class':'paginatn pull-right'}).adopt(ancs,
		// span to display no of pages created
		new Element('span',{'style':'color:#888;padding-left:20px;',
			'text': (pag_max > 0) ? '[ '+(pag_max+1)+' pages ]' : '[ 1 page ]' 
		})
	);
}


function disable_unimplemented_links(){
	var implemented = {
		'home': ['home'],
		'database': ['overview'],
		'table': ['browse', 'structure']
	}
	var section = page_hash()['section']
	$$('.nav a').each(function(nav_link){
		if ( ! implemented[section].contains( nav_link.get('html').toLowerCase() ) ){
			new Element('span', {
				'style': 'display: block;float: none;line-height: 19px;padding: 10px 10px 11px;text-decoration: none;',
				'text': nav_link.get('html'),
				'alt': 'feature not yet implemented',
				'help': 'feature not yet implemented'
				}
			).replaces(nav_link)
		}
	});	
}

function page_hash(){
	return location.hash.replace('#','').parseQueryString(false, true);
}

// get's a where statement for the selected table
function generate_where(tbl, row_in) {
	if (!tbl.vars.keys) return stmt;		// the table must have keys stored
	var stmt = "", keys = tbl.vars.keys;
	for (var i = 0; i < keys.length; i++) {
		if (keys[i][0] == "") continue;
		stmt += keys[i][0] + '=\'' + $(tbl).getElements('tr')[row_in].getElements('td')[keys[i][2]].get('text');
		stmt += (i != keys.length - 1) ? "\' & " : "\'"; // -1 becos the 
	}
	return stmt;
}