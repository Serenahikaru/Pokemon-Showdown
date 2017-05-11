'use strict';

function clearRoom(room) {
	let len = (room.log && room.log.length) || 0;
	let users = [];
	while (len--) {
		room.log[len] = '';
	}
	for (let u in room.users) {
		users.push(u);
		Users(u).leaveRoom(room, Users(u).connections[0]);
	}
	len = users.length;
	setTimeout(() => {
		while (len--) {
			Users(users[len]).joinRoom(room, Users(users[len]).connections[0]);
		}
	}, 1000);
}

exports.commands = {
	gclearall: 'globalclearall',
	globalclearall: function (target, room, user) {
		if (!this.can('gdeclare')) return false;

		Rooms.rooms.forEach(room => clearRoom(room));
		Users.users.forEach(user => user.popup('All rooms have been cleared.'));
		this.privateModCommand(`(${user.name} used /globalclearall.)`);
	},
	
	dm: 'daymute',
	daymute: function (target, room, user, connection, cmd) {
		if (!target) return this.errorReply("Usage: /dm [user], [reason].");
		if (!this.canTalk()) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		let targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > 300) {
			return this.sendReply("The reason is too long. It cannot exceed 300 characters.");
		}

		let muteDuration = 24 * 60 * 60 * 1000;
		if (!this.can('mute', targetUser, room)) return false;
		let canBeMutedFurther = ((room.getMuteTime(targetUser) || 0) <= (muteDuration * 5 / 6));
		if ((room.isMuted(targetUser) && !canBeMutedFurther) || targetUser.locked || !targetUser.connected) {
			let problem = " but was already " + (!targetUser.connected ? "offline" : targetUser.locked ? "locked" : "muted");
			if (!target) {
				return this.privateModCommand("(" + targetUser.name + " would be muted by " + user.name + problem + ".)");
			}
			return this.addModCommand("" + targetUser.name + " would be muted by " + user.name + problem + "." + (target ? " (" + target + ")" : ""));
		}

		if (targetUser in room.users) targetUser.popup("|modal|" + user.name + " has muted you in " + room.id + " for 24 hours. " + target);
		this.addModCommand("" + targetUser.name + " was muted by " + user.name + " for 24 hours." + (target ? " (" + target + ")" : ""));
		if (targetUser.autoconfirmed && targetUser.autoconfirmed !== targetUser.userid) this.privateModCommand("(" + targetUser.name + "'s ac account: " + targetUser.autoconfirmed + ")");
		this.add('|unlink|' + toId(this.inputUsername));

		room.mute(targetUser, muteDuration, false);
	},
	
	masspm: 'pmall',
	pmall: function (target, room, user) {
		if (!this.can('pmall')) return false;
		if (!target) return this.parse('/help pmall');

		let pmName = ' Server Info [Do Not Respond!]';
		Users.users.forEach(curUser => {
			let message = '|pm|' + pmName + '|' + curUser.getIdentity() + '|' + target;
			curUser.send(message);
		});
	},
	pmallhelp: ["/pmall [message]."],

	staffpm: 'pmallstaff',
	pmstaff: 'pmallstaff',
	pmallstaff: function (target, room, user) {
		if (!this.can('forcewin')) return false;
		if (!target) return this.parse('/help pmallstaff');

		let pmName = ' InFo.Staff';

		Users.users.forEach(curUser => {
			if (!curUser.isStaff) return;
			let message = '|pm|' + pmName + '|' + curUser.getIdentity() + '|' + target;
			curUser.send(message);
		});
	},
	pmallstaffhelp: ["/pmallstaff [message]"],
	
	seen: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) return this.parse('/help seen');
		let targetUser = Users.get(target);
		if (targetUser && targetUser.connected) return this.sendReplyBox(EM.nameColor(targetUser.name, true) + " is <b><font color='limegreen'>Currently Online</b></font>.");
		target = Chat.escapeHTML(target);
		let seen = Db('seen').get(toId(target));
		if (!seen) return this.sendReplyBox(EM.nameColor(target, true) + " has <b><font color='red'>never been online</font></b> on this server.");
		this.sendReplyBox(EM.nameColor(target, true) + " was last seen <b>" + Chat.toDurationString(Date.now() - seen, {precision: true}) + "</b> ago.");
	},
	seenhelp: ["/seen - Shows when the user last connected on the server."],
	
	regdate: function (target, room, user, connection) {
		if (!target) target = user.name;
		target = toId(target);
		if (target.length < 1 || target.length > 19) {
			return this.sendReply("Usernames can not be less than one character or longer than 19 characters. (Current length: " + target.length + ".)");
		}
		if (!this.runBroadcast()) return;
		EM.regdate(target, date => {
			if (date) {
				this.sendReplyBox(regdateReply(date));
			}
		});

		function regdateReply(date) {
			if (date === 0) {
				return EM.nameColor(target, true) + " <b><font color='red'>is not registered.</font></b>";
			} else {
				let d = new Date(date);
				let MonthNames = ["January", "February", "March", "April", "May", "June",
					"July", "August", "September", "October", "November", "December",
				];
				let DayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
				return EM.nameColor(target, true) + " was registered on <b>" + DayNames[d.getUTCDay()] + ", " + MonthNames[d.getUTCMonth()] + ' ' + d.getUTCDate() + ", " + d.getUTCFullYear() + "</b> at <b>" + d.getUTCHours() + ":" + d.getUTCMinutes() + ":" + d.getUTCSeconds() + " UTC.</b>";
			}
			//room.update();
		}
	},
	regdatehelp: ["/regdate - Gets the regdate (register date) of a username."],
	
	reddeclare: 'declare',
	greendeclare: 'declare',
	declare: function (target, room, user, connection, cmd, message) {
		if (!target) return this.parse('/help declare');
		if (!this.can('declare', null, room)) return false;
		if (!this.canTalk()) return;

		let color = 'blue';
		switch (cmd) {
		case 'reddeclare':
			color = 'red';
			break;
		case 'greendeclare':
			color = 'green';
			break;
		}
		this.add('|raw|<div class="broadcast-' + color + '"><b>' + Chat.escapeHTML(target) + '</b></div>');
		this.logModCommand(user.name + " declared " + target);
	},
	declarehelp: ["/declare [message] - Anonymously announces a message. Requires: # * & ~"],

	redhtmldeclare: 'htmldeclare',
	greenhtmldeclare: 'htmldeclare',
	htmldeclare: function (target, room, user, connection, cmd, message) {
		if (!target) return this.parse('/help htmldeclare');
		if (!this.can('gdeclare', null, room)) return false;
		if (!this.canTalk()) return;
		target = this.canHTML(target);
		if (!target) return;

		let color = 'blue';
		switch (cmd) {
		case 'redhtmldeclare':
			color = 'red';
			break;
		case 'greenhtmldeclare':
			color = 'green';
			break;
		}
		this.add('|raw|<div class="broadcast-' + color + '">' + target + '</div>');
		this.logModCommand(user.name + " declared " + target);
	},
	htmldeclarehelp: ["/htmldeclare [message] - Anonymously announces a message using safe HTML. Requires: ~"],
	
	redglobaldeclare: 'globaldeclare',
	greenglobaldeclare: 'globaldeclare',
	redgdeclare: 'globaldeclare',
	greengdeclare: 'globaldeclare',
	gdeclare: 'globaldeclare',
	globaldeclare: function (target, room, user, connection, cmd, message) {
		if (!target) return this.parse('/help globaldeclare');
		if (!this.can('gdeclare')) return false;
		target = this.canHTML(target);
		if (!target) return;

		let color = 'blue';
		switch (cmd) {
		case 'redglobaldeclare':
		case 'redgdeclare':
			color = 'red';
			break;
		case 'greenglobaldeclare':
		case 'greengdeclare':
			color = 'green';
			break;
		}
		Rooms.rooms.forEach((curRoom, id) => {
			if (id !== 'global') curRoom.addRaw('<div class="broadcast-' + color + '">' + target + '</div>').update();
		});
		this.logModCommand(user.name + " globally declared " + target);
	},
	globaldeclarehelp: ["/globaldeclare [message] - Anonymously announces a message to every room on the server. Requires: ~"],
	
	redchatdeclare: 'chatdeclare',
	greenchatdeclare: 'chatdeclare',
	redcdeclare: 'chatdeclare',
	greencdeclare: 'chatdeclare',
	cdeclare: 'chatdeclare',
	chatdeclare: function (target, room, user, connection, cmd, message) {
		if (!target) return this.parse('/help chatdeclare');
		if (!this.can('gdeclare')) return false;
		target = this.canHTML(target);
		if (!target) return;

		let color = 'blue';
		switch (cmd) {
		case 'reddeclare':
			color = 'red';
			break;
		case 'greendeclare':
			color = 'green';
			break;
		}
		Rooms.rooms.forEach((curRoom, id) => {
			if (id !== 'global' && curRoom.type !== 'battle') curRoom.addRaw('<div class="broadcast-' + color + '">' + target + '</div>').update();
		});
		this.logModCommand(user.name + " globally declared (chat level) " + target);
	},
	chatdeclarehelp: ["/cdeclare [message] - Anonymously announces a message to all chatrooms on the server. Requires: ~"],

	hide: 'hideauth',
	hideauth: function (target, room, user) {
		if (!this.can('lock')) return false;
		let tar = ' ';
		if (target) {
			target = target.trim();
			if (Config.groupsranking.indexOf(target) > -1 && target !== '#') {
				if (Config.groupsranking.indexOf(target) <= Config.groupsranking.indexOf(user.group)) {
					tar = target;
				} else {
					this.sendReply('The group symbol you have tried to use is of a higher authority than you have access to. Defaulting to \'' + tar + 'instead.');
				}
			} else {
				this.sendReply('You are now hiding your auth symbol as \'' + tar + '\'.');
			}
		}
		user.getIdentity = function (roomid) {
			return tar + this.name;
		};
		user.updateIdentity();
		return this.sendReply("You are now hiding your auth as ' " + tar + "'.");
	},
	hidehelp: ["/hide - Hides user's global rank. Requires: & ~"],

	show: 'showauth',
	showauth: function (target, room, user) {
		if (!this.can('lock')) return false;
		delete user.getIdentity;
		user.updateIdentity();
		return this.sendReply("You are now showing your authority!");
	},
	showhelp: ["/show - Displays user's global rank. Requires: & ~"],

};
