var tokenAction = tokenAction || (function() {
    'use strict';

    var version = '0.2.3',
        sheetVersion = '5th Edition OGL by Roll20 2.0',
        
    checkInstall = function() {
        log('TokenAction v'+version+' is ready!  Designed for use with the '+sheetVersion+' character sheet!');
    },
    
    getSelectedCharacters = function(selected) {
        return _.chain(selected)
            .map(function(s){
                return getObj(s._type,s._id);
            })
            .reject(_.isUndefined)
            .map(function(c){
                return getObj('character', c.get('represents'));
            })
            .filter(_.identity)
            .value();        
    },
    
    createAbility = function(name, pattern, id) {
        var checkAbility = findObjs({_type: 'ability', _characterid: id, name: name});
        
        if (checkAbility[0]) {
            checkAbility[0].set({action: pattern});
        } else {
            createObj('ability', {name: name, action: pattern, characterid: id, istokenaction: true});
        }
    },
    
    createRepeating = function(name, pattern, id) {
        var repeatingAttrs = filterObjs(function(o){
            return o.get('type')==='attribute' && o.get('characterid') === id && o.get('name').match(name);
        });
        
        _.each(repeatingAttrs,function(attr){
            var repeatingId = attr.get('name').split('_')[2],
                repeatingName = attr.get('current'),
                repeatingAction = "%{" + id + "|" + (pattern.replace(/%%RID%%/g,repeatingId)) + "}",
                checkAbility = findObjs({_type: 'ability', _characterid: id, name: repeatingName});
                
            if (checkAbility[0]) {
                checkAbility[0].set({action: repeatingAction});
            } else {
                createObj("ability", {name: repeatingName, action: repeatingAction, characterid: id, istokenaction: true});
            }
        });
    },
    
    isNpc = function(id) {
        var checkNpc = findObjs({_type: 'attribute', _characterid: id, name: 'npc'});
        if (_.isUndefined(checkNpc[0])) {
            return false;
        } else {
            return checkNpc[0].get('current');
        }
    },
    
    deleteAbilities = function(id) {
        var abilities = findObjs ({_type: 'ability', _characterid: id});
        _.each(abilities, function(r) {
            r.remove();
        });
    },
    
    createSpell = function(id) {
        var checkAbility = findObjs({_type: 'ability', _characterid: id, name: 'Spells'}),
            repeatingAttrs = filterObjs(function(o){
                return o.get('type') === 'attribute' && o.get('characterid') === id && o.get('name').match(/repeating_spell-\S+_[^_]+_spellname\b/);
            }),
            spellText = "",
            sk = [],
            sb = {
                'Cantrips': [],
                '1st': [],
                '2nd': [],
                '3rd': [],
                '4th': [],
                '5th': [],
                '6th': [],
                '7th': [],
                '8th': [],
                '9th': []
            };
        
        if (!repeatingAttrs[0]) {
            return;
        }
        
        if (repeatingAttrs[0].get('name').match('repeating_spell-npc')) {
            return;
        }
        
        _.each(repeatingAttrs, function(s){
            var level = s.get('name').split('_')[1].replace('spell-', ''),
                apiButton = "[" + s.get('current') + "](~repeating_spell-" + level + "_" + s.get('name').split('_')[2] + "_spell)";
            
            if (level === "cantrip") {
                level = "Cantrips";
            } else if (level === "1") {
                level = "1st";
            } else if (level === "2") {
                level = "2nd";
            } else if (level === "3") {
                level = "3rd";
            } else if (level === "4") {
                level = "4th";
            } else if (level === "5") {
                level = "5th";
            } else if (level === "6") {
                level = "6th";
            } else if (level === "7") {
                level = "7th";
            } else if (level === "8") {
                level = "8th";
            } else if (level === "9") {
                level = "9th";
            }
            
            sb[level].push(apiButton);
            sb[level].sort();
        });
        
        sk = _.keys(sb);
        
        _.each(sk, function(e){
            if (_.isEmpty(sb[e])){
                sb = _.omit(sb, e);
            }
        });
        
        sk = _.keys(sb);
        
        _.each(sk, function(e){
            spellText += "**" + e + ":**" + "\n" + sb[e].join(' | ') + "\n\n";
        });
        
        if (checkAbility[0]) {
            checkAbility[0].set({action: "/w @{character_name} &{template:atk} {{desc=" + spellText + "}}"});
        } else {
            createObj("ability", {name: 'Spells', action: "/w @{character_name} &{template:atk} {{desc=" + spellText + "}}", characterid: id, istokenaction: true});
        }
    },
    
    sortRepeating = function(name, pattern, id) {
        var repeatingAttrs = filterObjs(function(o){
            return o.get('type')==='attribute' && o.get('characterid') === id && o.get('name').match(name);
        }),
            sorted = _.sortBy(repeatingAttrs, (o)=> o.get('current'));
        
        _.each(sorted,function(attr){
            var repeatingId = attr.get('name').split('_')[2],
                repeatingName = "a-"+attr.get('current'),
                repeatingAction = "%{" + id + "|" + (pattern.replace(/%%RID%%/g,repeatingId)) + "}";
                if (pattern.match('npcaction-l')){
                    repeatingName = "al-"+attr.get('current');
                }
                var checkAbility = findObjs({_type: 'ability', _characterid: id, name: repeatingName});
                if (checkAbility[0]) {
                    checkAbility[0].set({action: repeatingAction});
                } else {
                    createObj("ability", {name: repeatingName, action: repeatingAction, characterid: id, istokenaction: true});
                }
        });
    },
    
    handleInput = function(msg) {
        var char;
        
		if (msg.type === 'api' && msg.content.search(/^!ta\b/) !== -1 && msg.selected) {
			char = _.uniq(getSelectedCharacters(msg.selected));
			
			_.each(char, function(a) {
			    if (isNpc(a.id) === "1") {
			        createAbility('Init', "%{" + a.id + "|npc_init}", a.id);
			        createRepeating(/repeating_npcaction_[^_]+_name\b/, 'repeating_npcaction_%%RID%%_npc_action', a.id);
			        createRepeating(/repeating_npcaction-l_[^_]+_name\b/, 'repeating_npcaction-l_%%RID%%_npc_action', a.id);
			        createSpell(a.id);
			    } else {
			        createAbility('Init', "%{" + a.id + "|initiative}", a.id);
			        createAbility('Check', "&{template:simple} {{always=1}} ?{Ability|Strength, {{rname=Strength&" + "#125;&" + "#125; {{mod=@{selected|strength_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|strength_mod}@{selected|jack_attr}[STR]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|strength_mod}@{selected|jack_attr}[STR]]]&" + "#125;&" + "#125; |Dexterity, {{rname=Dexterity&" + "#125;&" + "#125; {{mod=@{selected|dexterity_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|dexterity_mod}@{selected|jack_attr}[DEX]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|dexterity_mod}@{selected|jack_attr}[DEX]]]&" + "#125;&" + "#125; |Constitution, {{rname=constitution&" + "#125;&" + "#125; {{mod=@{selected|constitution_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|constitution_mod}@{selected|jack_attr}[CON]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|constitution_mod}@{selected|jack_attr}[CON]]]&" + "#125;&" + "#125; |Intelligence, {{rname=intelligence&" + "#125;&" + "#125; {{mod=@{selected|intelligence_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|intelligence_mod}@{selected|jack_attr}[INT]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|intelligence_mod}@{selected|jack_attr}[INT]]]&" + "#125;&" + "#125; |Wisdom, {{rname=wisdom&" + "#125;&" + "#125; {{mod=@{selected|wisdom_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|wisdom_mod}@{selected|jack_attr}[WIS]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|wisdom_mod}@{selected|jack_attr}[WIS]]]&" + "#125;&" + "#125; |Charisma, {{rname=charisma&" + "#125;&" + "#125; {{mod=@{selected|charisma_mod}@{selected|jack_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|charisma_mod}@{selected|jack_attr}[CHA]]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|charisma_mod}@{selected|jack_attr}[CHA]]]&" + "#125;&" + "#125; |Acrobatics, {{rname=Acrobatics&" + "#125;&" + "#125; {{mod=@{selected|acrobatics_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|acrobatics_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|acrobatics_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Animal Handling, {{rname=Animal Handling&" + "#125;&" + "#125; {{mod=@{selected|animal_handling_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|animal_handling_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|animal_handling_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Arcana, {{rname=Arcana&" + "#125;&" + "#125; {{mod=@{selected|arcana_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|arcana_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|arcana_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Athletics, {{rname=Athletics&" + "#125;&" + "#125; {{mod=@{selected|athletics_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|athletics_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|athletics_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Deception, {{rname=Deception&" + "#125;&" + "#125; {{mod=@{selected|deception_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|deception_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|deception_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |History, {{rname=History&" + "#125;&" + "#125; {{mod=@{selected|history_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|history_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|history_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Insight, {{rname=Insight&" + "#125;&" + "#125; {{mod=@{selected|insight_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|insight_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|insight_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Intimidation, {{rname=Intimidation&" + "#125;&" + "#125; {{mod=@{selected|intimidation_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|intimidation_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|intimidation_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Investigation, {{rname=Investigation&" + "#125;&" + "#125; {{mod=@{selected|investigation_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|investigation_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|investigation_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Medicine, {{rname=Medicine&" + "#125;&" + "#125; {{mod=@{selected|medicine_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|medicine_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|medicine_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Nature, {{rname=Nature&" + "#125;&" + "#125; {{mod=@{selected|nature_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|nature_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|nature_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Perception, {{rname=Perception&" + "#125;&" + "#125; {{mod=@{selected|perception_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|perception_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|perception_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Performance, {{rname=Performance&" + "#125;&" + "#125; {{mod=@{selected|performance_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|performance_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|performance_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Persuasion, {{rname=Persuasion&" + "#125;&" + "#125; {{mod=@{selected|persuasion_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|persuasion_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|persuasion_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Religion, {{rname=Religion&" + "#125;&" + "#125; {{mod=@{selected|religion_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|religion_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|religion_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Sleight of Hand, {{rname=Sleight of Hand&" + "#125;&" + "#125; {{mod=@{selected|sleight_of_hand_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|sleight_of_hand_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|sleight_of_hand_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Stealth, {{rname=Stealth&" + "#125;&" + "#125; {{mod=@{selected|stealth_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|stealth_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|stealth_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; |Survival, {{rname=Survival&" + "#125;&" + "#125; {{mod=@{selected|survival_bonus}&" + "#125;&" + "#125; {{r1=[[ @{selected|d20} + @{selected|survival_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; {{r2=[[ @{selected|d20} + @{selected|survival_bonus}@{selected|pbd_safe} ]]&" + "#125;&" + "#125; } @{selected|global_skill_mod} @{selected|charname_output}}", a.id);
			        createAbility('Save', "&{template:simple} {{always=1}} ?{Save|Strength, {{rname=Strength Save&" + "#125;&" + "#125 {{mod=@{selected|strength_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|strength_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|strength_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; |Dexterity, {{rname=Dexterity Save&" + "#125;&" + "#125 {{mod=@{selected|dexterity_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|dexterity_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|dexterity_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; |Constitution, {{rname=Constitution Save&" + "#125;&" + "#125 {{mod=@{selected|constitution_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|constitution_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|constitution_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; |Intelligence, {{rname=Intelligence Save&" + "#125;&" + "#125 {{mod=@{selected|intelligence_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|intelligence_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|intelligence_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; |Wisdom, {{rname=Wisdom Save&" + "#125;&" + "#125 {{mod=@{selected|wisdom_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|wisdom_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|wisdom_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; |Charisma, {{rname=Charisma Save&" + "#125;&" + "#125 {{mod=@{selected|charisma_save_bonus}&" + "#125;&" + "#125; {{r1=[[@{selected|d20}+@{selected|charisma_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125; {{r2=[[@{selected|d20}+@{selected|charisma_save_bonus}@{selected|pbd_safe}]]&" + "#125;&" + "#125;}@{selected|global_save_mod}@{selected|charname_output}", a.id);
			        createRepeating(/repeating_attack_[^_]+_atkname\b/, 'repeating_attack_%%RID%%_attack', a.id);
			        createSpell(a.id);
			    }
			    sendChat("TokenAction", "/w " + msg.who + " Created Token Actions for " + a.get('name') + ".");
			});
		} else if (msg.type === 'api' && msg.content.search(/^!deleteta\b/) !== -1 && msg.selected) {
		    char = _.uniq(getSelectedCharacters(msg.selected));
		    
		    _.each(char, function(d) {
		        deleteAbilities(d.id);
		        sendChat("TokenAction", "/w " + msg.who + " Deleted Token Actions for " + d.get('name') + ".");
		    });
		} else if (msg.type === 'api' && msg.content.search(/^!sortta\b/) !== -1 && msg.selected) {
		    char = _.uniq(getSelectedCharacters(msg.selected));
		    
		    _.each(char, function(a) {
		        if (isNpc(a.id) === "1") {
		            createAbility('Init', "%{" + a.id + "|npc_init}", a.id);
		            sortRepeating(/repeating_npcaction_[^_]+_name\b/, 'repeating_npcaction_%%RID%%_npc_action', a.id);
		            sortRepeating(/repeating_npcaction-l_[^_]+_name\b/, 'repeating_npcaction-l_%%RID%%_npc_action', a.id);
		            createSpell(a.id);
		        }
		        sendChat("TokenAction", "/w " + msg.who + " Created Token Actions for " + a.get('name') + ".");
		    });
		}
		return;
	},

    registerEventHandlers = function() {
        on('chat:message', handleInput);
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers
    };
}());

on('ready',function() {
    'use strict';

    tokenAction.CheckInstall();
    tokenAction.RegisterEventHandlers();
});
