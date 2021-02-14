#!/usr/bin/env node

const fs = require(`fs`)
const os = require(`os`)
const readline = require(`readline`);

const INPUT_STATE_INTRO = 0;
const INPUT_STATE_COMMAND = 1;
const INPUT_STATE_LOAD = 2;
const INPUT_STATE_SAVE = 3;
const COMMAND_PROMPT = ``;

const ESCAPE_CHARACTER = String.fromCharCode(27);
const INPUT_RECORD_SEPARATOR = os.EOL;
const REALLY_BIG_NUMBER = 32767;
const ACTION_COMMAND_OFFSET = 6;
const ACTION_ENTRIES = 8;
const AUTO = 0;
const COMMAND_CODE_DIVISOR = 150;
const COMMANDS_IN_ACTION = 4;
const CONDITION_DIVISOR = 20;
const CONDITIONS = 5;
const COUNTER_TIME_LIMIT = 8;
const DIRECTION_NOUNS = 6;
const FALSE = false;
const FALSE_VALUE = 0;
const FLAG_LAMP_EMPTY = 16;
const FLAG_NIGHT = 15;
const LIGHT_SOURCE_ID = 9;
const LIGHT_WARNING_THRESHOLD = 25;
const MESSAGE_1_END = 51;
const MESSAGE_2_START = 102;
const PAR_CONDITION_CODE = 0;
const PERCENT_UNITS = 100;
const ROOM_INVENTORY = -1;
const ROOM_STORE = 0;
const ROUNDING_OFFSET = 0.5;
const TRUE = true;
const TRUE_VALUE = 1;
const VERB_CARRY = 10;
const VERB_DROP = 18;
const VERB_GO = 1;
const ALTERNATE_ROOM_REGISTERS = 6;
const ALTERNATE_COUNTERS = 9;
const STATUS_FLAGS = 32;
const MINIMUM_COUNTER_VALUE = -1;
const DIRECTION_NOUN_TEXT = [`NORTH`, `SOUTH`, `EAST`, `WEST`, `UP`, `DOWN`];

var ARGV = process.argv.slice(2);

// Declaration of variables and arrays
var game_file;    // Filename of game data file
var keyboard_input, keyboard_input_2;
var carried_objects, command_or_display_message, command_parameter,
    command_parameter_index, cont_flag, counter_register, current_room,
    global_noun, max_objects_carried, number_of_actions, number_of_messages,
    number_of_objects, number_of_rooms, number_of_treasures, number_of_words,
    starting_room, stored_treasures, time_limit, treasure_room_id, word_length,
    adventure_version, adventure_number, game_bytes;
var alternate_counter = [], alternate_room = [];

var object_description = [], message = [], extracted_input_words = [],
    list_of_verbs_and_nouns = [], room_description = [];
var action_data = [], action_description = [], object_original_location = [],
    object_location = [], found_word = [], room_exit = [], status_flag = [];
var command_in_handle, command_out_handle;
var flag_debug;

var input_state = INPUT_STATE_INTRO; // Used to keep track of what is reading input in the readline callback

// Debugging symbols, based on the naming convention from Allan Moluf
var condition_name = [`Par`, `HAS`, `IN/W`, `AVL`, `IN`, `-IN/W`, `-HAVE`,
    `-IN`, `BIT`, `-BIT`, `ANY`, `-ANY`, `-AVL`, `-RM0`, `RM0`, `CT<=`, `CT>`,
    `ORIG`, `-ORIG`, `CT=`,
];
var command_name = [`GETx`, `DROPx`, `GOTOy`, `x->RM0`, `NIGHT`, `DAY`, `SETz`,
    `x->RM0`, `CLRz`, `DEAD`, `x->y`, `FINI`, `DspRM`, `SCORE`, `INV`, `SET0`,
    `CLR0`, `FILL`, `CLS`, `SAVE`, `EXx,x`, `CONT`, `AGETx`, `BYx<-x`, `DspRM`,
    `CT-1`, `DspCT`, `CT<-n`, `EXRM0`, `EXm,CT`, `CT+n`, `CT-n`, `SAYw`,
    `SAYwCR`, `SAYCR`, `EXc,CR`, `DELAY`,
];

// Code for all the action conditions
var condition_function = [
    //  0 Par
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return TRUE;
    },

    //  1 HAS
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result = FALSE;
        if (object_location[parameter] === ROOM_INVENTORY) {
            result = TRUE;
        }
        return result;
    },

    //  2 IN/W
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (object_location[parameter] === current_room);
    },

    //  3 AVL
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result;
        result = (object_location[parameter] === ROOM_INVENTORY);
        result = result || (object_location[parameter] === current_room);
        return result;
    },

    //  4 IN
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (current_room === parameter);
    },

    //  5 -IN/W
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (object_location[parameter] !== current_room);
    },

    //  6 -HAVE
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result = FALSE;
        if (object_location[parameter] !== ROOM_INVENTORY) {
            result = TRUE;
        }
        return result;
    },

    //  7 -IN
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (current_room !== parameter);
    },

    //  8 BIT
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result;

        result = status_flag[parameter];
        return result;
    },

    //  9 -BIT
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result;

        result = (!status_flag[parameter]);
        return result;
    },

    // 10 ANY
    function () {
        var result = FALSE;
        object_location.forEach(location => {
            if (location === ROOM_INVENTORY) {
                result = TRUE;
            }
        });
        return result;
    },

    // 11 -ANY
    function () {
        var result = FALSE;
        object_location.forEach(location => {
            if (location === ROOM_INVENTORY) {
                result = TRUE;
            }
        });
        return (!result);
    },

    // 12 -AVL
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        var result;
        result = (object_location[parameter] === ROOM_INVENTORY);
        result = result || (object_location[parameter] === current_room);
        return (!result);
    },

    // 13 -RM0
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (object_location[parameter] != ROOM_STORE);
    },

    // 14 RM0
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return (object_location[parameter] === ROOM_STORE);
    },

    // Newer post-1978 conditions below

    // 15 CT<=
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return counter_register <= parameter;
    },

    // 16 CT>
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return counter_register > parameter;
    },

    // 17 ORIG
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return object_original_location[parameter] ===
            object_location[parameter];
    },

    // 18 -ORIG
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return !(object_original_location[parameter] ===
            object_location[parameter]);
    },

    // 19 CT=
    function () {
        var condition_argument = Array.from(arguments);
        var parameter = condition_argument.shift();
        return counter_register === parameter;
    },
];

// Code for all the action commands
var command_function = [

    //  0 GETx
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();

        carried_objects = 0;

        object_location.forEach(location => {
            if (location == ROOM_INVENTORY) {
                carried_objects++;
            }
        });
        if (carried_objects >= max_objects_carried) {
            console.log(`I've too much too carry. try -take inventory-`);

            // Stop processing later commands if this one fails
            var continue_executing = condition_argument.shift();
            continue_executing.value = FALSE;
        }
        get_command_parameter(action_id);
        object_location[command_parameter] = ROOM_INVENTORY;
    },

    //  1 DROPx
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();

        get_command_parameter(action_id);
        object_location[command_parameter] = current_room;
    },

    //  2 GOTOy
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        current_room = command_parameter;
    },

    //  3 x->RM0
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        object_location[command_parameter] = 0;
    },

    //  4 NIGHT
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        status_flag[FLAG_NIGHT] = TRUE;
    },

    //  5 DAY
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        status_flag[FLAG_NIGHT] = FALSE;
    },

    //  6 SETz
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        status_flag[command_parameter] = TRUE;
    },

    //  7 x->RM0
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        object_location[command_parameter] = 0;
    },

    //  8 CLRz
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        status_flag[command_parameter] = FALSE;
    },

    //  9 DEAD
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(`I'm dead...`);
        current_room = number_of_rooms;
        status_flag[FLAG_NIGHT] = FALSE;
        show_room_description();
    },

    // 10 x->y
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        var temporary_1 = command_parameter;
        get_command_parameter(action_id);
        object_location[temporary_1] = command_parameter;
    },

    // 11 FINI
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        process.exit(0);
    },

    // 12 DspRM
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        show_room_description();
    },

    // 13 SCORE
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        stored_treasures = 0;
        {
            var object = 0;
            object_location.forEach(location => {
                if (location === treasure_room_id) {
                    if (object_description[object].substr(0, 1) === `*`) {
                        stored_treasures++;
                    }
                }
                object++;
            });
        }

        console.log(`I've stored ${stored_treasures} treasures. `
            + `ON A SCALE OF 0 TO ${PERCENT_UNITS} THAT RATES A `
            + Math.floor(stored_treasures / number_of_treasures * PERCENT_UNITS)
        );

        if (stored_treasures === number_of_treasures) {
            console.log(`Well done.`);
            process.exit(0);
        }
    },

    // 14 INV
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(`I'm carrying:`);
        var carrying_nothing_text = `Nothing`;
        var object_text;
        var list_of_objects_in_text = ``;
        {
            var object = 0;
            for (object_index in object_location) {
                var location = object_location[object_index]
                if (location !== ROOM_INVENTORY) {
                    object++;
                    continue;
                }
                else {
                    object_text = strip_noun_from_object_description(object);
                }
                list_of_objects_in_text += `${object_text}. `;
                carrying_nothing_text = ``;
                object++;
            }
        }
        console.log(`${list_of_objects_in_text}${carrying_nothing_text}\n`);
    },

    // 15 SET0
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        command_parameter = 0;
        status_flag[command_parameter] = TRUE;
    },

    // 16 CLR0
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        command_parameter = 0;
        status_flag[command_parameter] = FALSE;
    },

    // 17 FILL
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        alternate_counter[COUNTER_TIME_LIMIT] = time_limit;
        object_location[LIGHT_SOURCE_ID] = ROOM_INVENTORY;
        status_flag[FLAG_LAMP_EMPTY] = FALSE;
    },

    // 18 CLS
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        cls();
    },

    // 19 SAVE
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();

        console.log(`Name of save file:`);
        input_state = INPUT_STATE_SAVE;
        rl.setPrompt(``);
    },

    // 20 EXx,x
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        var temporary_1 = command_parameter;
        get_command_parameter(action_id);
        var temporary_2 = object_location[command_parameter];
        object_location[command_parameter] = object_location[temporary_1];
        object_location[temporary_1] = temporary_2;
    },

    // 21 CONT
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        cont_flag = TRUE;
    },

    // 22 AGETx
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        carried_objects = 0;
        get_command_parameter(action_id);
        object_location[command_parameter] = ROOM_INVENTORY;
    },

    // 23 BYx<-x
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        var first_object = command_parameter;
        get_command_parameter(action_id);
        var second_object = command_parameter;
        object_location[first_object] = object_location[second_object];
    },

    // 24 DspRM
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        show_room_description();
    },

    // Newer post-1978 commands below

    // 25 CT-1
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        counter_register--;
    },

    // 26 DspCT
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(counter_register)
    },

    // 27 CT<-n
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        counter_register = command_parameter;
    },

    // 28 EXRM0
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        var temp = current_room;
        current_room = alternate_room[0];
        alternate_room[0] = temp;
    },

    // 29 EXm,CT
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        var temp = counter_register;
        counter_register = alternate_counter[command_parameter];
        alternate_counter[command_parameter] = temp;
    },

    // 30 CT+n
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        counter_register += command_parameter;
    },

    // 31 CT-n
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        counter_register -= command_parameter;

        // According to ScottFree source, the counter has a minimum value of -1
        if (counter_register < MINIMUM_COUNTER_VALUE) {
            counter_register = MINIMUM_COUNTER_VALUE;
        }
    },

    // 32 SAYw
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(global_noun);
    },

    // 33 SAYwCR
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(global_noun);
    },

    // 34 SAYCR
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        console.log(``);
    },

    // 35 EXc, CR
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        get_command_parameter(action_id);
        var temp = current_room;
        current_room = alternate_room[command_parameter];
        alternate_room[command_parameter] = temp;
    },

    // 36 DELAY
    function () {
        var condition_argument = Array.from(arguments);
        var action_id = condition_argument.shift();
        // Should be pause of around ~1 second, but no "sleep" function in js?
    },
];

command_or_display_message = 0;

// Get commandline options
[command_in_handle, command_out_handle, flag_debug] = commandline_options();

// Load game data file, if specified
if (ARGV.length > 0) {
    game_file = ARGV.shift();
    load_game_data_file();
}
else {
    commandline_help();
}

// Initialize values
current_room = starting_room; // Set current room to starting room
alternate_room = Array(ALTERNATE_ROOM_REGISTERS).fill(0);
alternate_counter = Array(ALTERNATE_COUNTERS).fill(0);
counter_register = 0;
status_flag = Array(STATUS_FLAGS).fill(FALSE);
status_flag[FLAG_NIGHT] = FALSE; // Day flag???
alternate_counter[COUNTER_TIME_LIMIT] = time_limit; // Set time limit counter

// Initialize keyboard input callback/loop
var rl = readline.createInterface({
    input: command_in_handle,
    output: process.stdout,
    prompt: COMMAND_PROMPT
});

rl.on(`line`, (line) => get_input(line)).on(`close`, () => say_goodbye());
if (input_state === INPUT_STATE_INTRO) {
    show_intro(); // Show intro
    rl.setPrompt(``);
}

// Main keyboard command input callback
// A global "input state" variable is needed, which affects which code runs inside the callback function.
// In the callback function, different behaviors emerge, depending on how the "input state" variable is set.
// The input state variable value can signify things like:
// "intro", "main command input", "save game" and "load game".
function get_input(line) {
    switch (input_state) {
        case INPUT_STATE_INTRO:
            cls();
            input_state = INPUT_STATE_COMMAND;
            rl.setPrompt(COMMAND_PROMPT);
            show_room_description(); // Show room
            found_word[0] = 0;
            run_actions(found_word[0], 0);
            console.log(`Tell me what to do`);
            rl.prompt();
            break;
        case INPUT_STATE_COMMAND:
            keyboard_input_2 = line.trim();
            process_input();
            // Loading or saving will change "input_state". Only print "Tell me what to do" if we're still in the "command" state.
            if (input_state === INPUT_STATE_COMMAND) {
                console.log(`Tell me what to do`);
            }
            rl.prompt();
            break;
        case INPUT_STATE_LOAD:
            rl.setPrompt(COMMAND_PROMPT);
            if (load_game(line)) {
                show_room_description();
            }
            console.log(`Tell me what to do`);
            rl.prompt();
            input_state = INPUT_STATE_COMMAND;
            break;
        case INPUT_STATE_SAVE:
            rl.setPrompt(COMMAND_PROMPT);
            save_game(line);
            console.log(`Tell me what to do`);
            rl.prompt();
            input_state = INPUT_STATE_COMMAND;
            break;

    }
    print_debug(status_flag.join(` `), 37);
    print_debug(alternate_counter.join(` `), 37);
}

function process_input() {
    console.log(``);
    var load_game_pattern = new RegExp(`^\\s*LOAD\\s*GAME`, `i`)
    if (load_game_pattern.test(keyboard_input_2)) {
        console.log(`Name of save file:`);
        input_state = INPUT_STATE_LOAD;
        rl.setPrompt(``);
    } else {
        extract_words();

        var undefined_words_found = (found_word[0] < 1) || (extracted_input_words[1].length > 0) && (found_word[1] < 1);
        if ((found_word[0] === VERB_CARRY) || (found_word[0] === VERB_DROP)) {
            undefined_words_found = FALSE;
        }

        if (undefined_words_found) {
            console.log(`You use word(s) i don't know`);
        }
        else {
            run_actions(found_word[0], found_word[1]);
            if (input_state !== INPUT_STATE_SAVE) {
                check_and_change_light_source_status();
                found_word[0] = 0;
                run_actions(found_word[0], found_word[1]);
            }
        }
    }
}

function commandline_help() {
    console.log(`Usage: tensodoct.js [OPTION]... game_data_file
Scott Adams adventure game interpreter

-i, --input    Command input file
-o, --output   Command output file
-d, --debug    Show game debugging info
-h, --help     Display this help and exit`);
    process.exit(0);
}

function commandline_options() {
    var in_handle;
    var out_handle;
    var return_value = [];    // Return input and output handles as an array
    var option_variable = {};

    get_options({
        'i|input=s': `input`,
        'o|output=s': `output`,
        'd|debug': `flag_debug`,
        'h|help': `flag_help`
    }, option_variable);

    if (option_variable.flag_help) {
        commandline_help();
    }
    // If no command input file defined, use STDIN for input
    if (typeof option_variable.input === `undefined`) {
        in_handle = process.stdin;
    }
    else {
        if (fs.existsSync(option_variable.input)) {
            try {
                in_handle = fs.createReadStream(option_variable.input);
            } catch (err) {
                console.error(err)
                process.exit(1);
            }
        }
        else {
            console.error(`file \"${option_variable.input}\" not found`)
            process.exit(1);
        }
    }
    return_value.push(in_handle);

    // If command output file defined, write output to it
    if (typeof option_variable.output !== `undefined`) {
        try {
            out_handle = fs.openSync(option_variable.output, `w`);
        } catch (err) {
            console.error(err)
            process.exit(1);
        }
    }

    return_value.push(out_handle);
    return_value.push(option_variable.flag_debug);
    return return_value;
}

function strip_noun_from_object_description(object_number) {
    var stripped_text = object_description[object_number];
    var re = new RegExp(`\/.*\/`);
    stripped_text = stripped_text.replace(/\/.*\//, ``);
    return stripped_text;
}

function check_and_change_light_source_status() {
    if (object_location.length > LIGHT_SOURCE_ID) { // Check that light source object exists

        if (object_location[LIGHT_SOURCE_ID] == ROOM_INVENTORY) {
            alternate_counter[COUNTER_TIME_LIMIT]--;
            if (alternate_counter[COUNTER_TIME_LIMIT] < 0) {
                console.log(`Light has run out`);
                object_location[LIGHT_SOURCE_ID] = 0;
            }
            else if (alternate_counter[COUNTER_TIME_LIMIT] < LIGHT_WARNING_THRESHOLD) {
                console.log(`Light runs out in ${alternate_counter[COUNTER_TIME_LIMIT]} turns!`);
            }
        }
    }
    return 1;
}

function say_goodbye() {
    console.log('Have a great day!');
    process.exit(0);
}

function show_intro() {
    cls();
    var intro_message = `                 *** Welcome ***

 Unless told differently you must find *TREASURES*
and-return-them-to-their-proper--place!

I'm your puppet. Give me english commands that
consist of a noun and verb. Some examples...

To find out what you're carrying you might say: TAKE INVENTORY
to go into a hole you might say: GO HOLE
to save current game: SAVE GAME

You will at times need special items to do things: But I'm
sure you'll be a good adventurer and figure these things out.

     Happy adventuring... Hit enter to start`
    console.log(intro_message);
    return 1;
}

function show_room_description() {
    if (status_flag[FLAG_NIGHT]) {    // Is the day flag true? (is this correct??)
        // Check that item #9 (light source) is either in inventory or current room
        if (object_location[LIGHT_SOURCE_ID] != ROOM_INVENTORY) {
            if (object_location[LIGHT_SOURCE_ID] != current_room) {
                console.log(`I can't see: Its too dark.`);
                return;
            }
        }
    }

    var room_text_line;
    // Show general description        
    if (room_description[current_room].substr(0, 1) === `*`) {
        room_text_line = room_description[current_room].substr(1);
    }
    else {
        room_text_line = `I'm in a ${room_description[current_room]}`;
    }

    // List objects
    var objects_found = FALSE;
    var text_of_objects_in_room = ``;
    {
        var object = 0;
        var location_index;
        for (location_index in object_location) {
            if (object_location[location_index] === current_room) {
                if (objects_found === FALSE) {
                    room_text_line += `. Visible items here: `;
                    objects_found = TRUE;
                }
                text_of_objects_in_room += strip_noun_from_object_description(object) + `. `;
            }
            object++;
        }
    }
    console.log(room_text_line);
    console.log(text_of_objects_in_room);

    // List exits
    var exit_found = FALSE;
    var exit_text_line = ``
    {
        var direction = 0;
        for (exit_index in room_exit[current_room]) {
            var exit = room_exit[current_room][exit_index];
            if (exit !== 0) {
                if (exit_found === FALSE) {
                    exit_text_line = `Obvious exits: `;
                    exit_found = TRUE;
                }
                exit_text_line += `${DIRECTION_NOUN_TEXT[direction]} `;
            }
            direction++;
        }
    }
    console.log(`${exit_text_line}\n`);
    return 1;
}

// Emulate basic "GetOpt" functionality from Perl
function get_options(option_template, option_variable) {
    for (var declaration_candidate in option_template) {
        var declaration_pattern = new RegExp(`^(\\w+(?:\\|\\w+)*)(?:=([si]))?$`);
        var declaration_field = declaration_pattern.exec(declaration_candidate);
        if (declaration_field === null) {
            process.exit(1); // If we have declared an invalid pattern, it's best to stop.
        }

        var option_pattern = new RegExp(`(?:(?<=^-)|(?<=^--))(?:${declaration_field[1]})$`);
        var new_argv = [];

        var skip_argument = false; // Skip the next argument if it was used as a parameter for an option
        for (commandline_index in ARGV) {
            commandline_argument = ARGV[commandline_index]
            if (option_pattern.exec(commandline_argument) !== null) {
                if (typeof declaration_field[2] === `undefined`) { // Boolean
                    option_variable[option_template[declaration_candidate]] = true;
                } else if (declaration_field[2] === `i`) { // Integer
                    var parameter_index = Number(commandline_index) + 1;
                    if (typeof ARGV[parameter_index] !== `undefined`) { // Check that next value actually exists
                        number_candidate = ARGV[parameter_index];
                        var integer_pattern = new RegExp(`^-?\\d+$`);
                        if (integer_pattern.exec(number_candidate) !== null) {
                            option_variable[option_template[declaration_candidate]] = Number(number_candidate);
                        } else { option_variable[option_template[declaration_candidate]] = 0; }
                        skip_argument = true;
                    }
                } else if (declaration_field[2] === `s`) { // String
                    var parameter_index = Number(commandline_index) + 1;
                    if (typeof ARGV[parameter_index] !== `undefined`) { // Check that next value actually exists
                        option_variable[option_template[declaration_candidate]] = ARGV[parameter_index];
                        skip_argument = true;
                    }
                } else {
                    process.exit(1); // If we have declared an invalid pattern, it's best to stop.
                }
            } else if (skip_argument) {
                skip_argument = false;
            }
            else {
                new_argv.push(commandline_argument);
            }
        };
        ARGV = new_argv;
    }
}

function handle_go_verb() {
    var room_dark = status_flag[FLAG_NIGHT];
    if (room_dark) {
        room_dark = status_flag[FLAG_NIGHT];
        room_dark = room_dark && (object_location[LIGHT_SOURCE_ID] !== current_room);
        room_dark = room_dark && (object_location[LIGHT_SOURCE_ID] !== TRUE);

        if (room_dark) {
            console.log(`Dangerous to move in the dark!`);
        }
    }
    if (found_word[1] < 1) {
        console.log(`Give me a direction too.`);
        return 1;
    }
    var direction_destination = room_exit[current_room][found_word[1] - 1];
    if (direction_destination < 1) {
        if (room_dark) {
            console.log(`I fell down and broke my neck.`);
            direction_destination = number_of_rooms;
            status_flag[FLAG_NIGHT] = FALSE;
        }
        else {
            console.log(`I can't go in that direction`);
            return 1;
        }
    }
    current_room = direction_destination;
    show_room_description();    // Show room description
    return 1;
}

function get_command_parameter(current_action) {
    if (current_action == null) {
        console.error(`Couldn't get command for unspecified action`);
        process.exit(1);
    }

    var condition_code = 1;
    while (condition_code != PAR_CONDITION_CODE) {
        var condition_line = action_data[current_action][command_parameter_index];
        command_parameter = Math.floor(condition_line / CONDITION_DIVISOR);
        condition_code = condition_line - command_parameter * CONDITION_DIVISOR;
        command_parameter_index++;
    }
    return 1;
}

function decode_command_from_data(command_number, action_id) {
    var command_code;
    var merged_command_index = Math.floor(command_number / 2 + ACTION_COMMAND_OFFSET);

    // Even or odd command number?
    if (command_number % 2) {
        command_code =
            action_data[action_id][merged_command_index] -
            Math.floor(
                action_data[action_id][merged_command_index] /
                COMMAND_CODE_DIVISOR) *
            COMMAND_CODE_DIVISOR;
    }
    else {
        command_code = Math.floor(action_data[action_id][merged_command_index] / COMMAND_CODE_DIVISOR);
    }
    return command_code;
}

function load_game_data_file() {
    var file_content;
    var next;
    if (fs.existsSync(game_file)) {
        try {
            var file_content = fs.readFileSync(game_file, `utf8`);
        } catch (e) {
            console.log('Error:', e.stack);
        }
    }
    else {
        console.error(`file \"${game_file}\" not found`)
        process.exit(1);
    }

    // Define pattern for finding three types of newlines
    const unix = `(?<![\\x0d])[\\x0a](?![\\x0d])`;
    const apple = `(?<![\\x0a])[\\x0d](?![\\x0a])`;
    const dos = `(?<![\\x0d])[\\x0d][\\x0a](?![\\x0a])`;
    const newline_pattern = new RegExp(`${unix}|${apple}|${dos}`, `g`)

    // Replace newline in file with whatever the current system uses
    file_content = file_content.replace(newline_pattern, INPUT_RECORD_SEPARATOR);

    next = file_content;

    // extract fields from room entry from data file
    const room_pattern = /\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*"([^"]*)"([\s\S]*)/;

    // extract fields from object entry
    const object_pattern = /\s*\"([^"]*)"\s*(-?\d+)([\s\S]*)/;

    // extract data from a verb or a noun
    const word_pattern = /\s*"([*]?[^"]*?)"([\s\S]*)/;

    // extract data from a general text field
    const text_pattern = /\s*"([^"]*)"([\s\S]*)/;

    // extract a numerical value
    const number_pattern = /\s*(-?\d+)([\s\S]*)/;

    [_, game_bytes, next] = number_pattern.exec(next);
    [_, number_of_objects, next] = number_pattern.exec(next);
    [_, number_of_actions, next] = number_pattern.exec(next);
    [_, number_of_words, next] = number_pattern.exec(next);
    [_, number_of_rooms, next] = number_pattern.exec(next);
    [_, max_objects_carried, next] = number_pattern.exec(next);
    if (max_objects_carried < 0) {
        max_objects_carried = REALLY_BIG_NUMBER;
    }
    [_, starting_room, next] = number_pattern.exec(next);
    [_, number_of_treasures, next] = number_pattern.exec(next);
    [_, word_length, next] = number_pattern.exec(next);
    [_, time_limit, next] = number_pattern.exec(next);
    [_, number_of_messages, next] = number_pattern.exec(next);
    [_, treasure_room_id, next] = number_pattern.exec(next);

    // Extracted as strings and need to be converted to numbers
    game_bytes = Number(game_bytes);
    number_of_objects = Number(number_of_objects);
    number_of_actions = Number(number_of_actions);
    number_of_words = Number(number_of_words);
    number_of_rooms = Number(number_of_rooms);
    max_objects_carried = Number(max_objects_carried);
    starting_room = Number(starting_room);
    number_of_treasures = Number(number_of_treasures);
    word_length = Number(word_length);
    time_limit = Number(time_limit);
    number_of_messages = Number(number_of_messages);
    treasure_room_id = Number(treasure_room_id);

    // Actions
    {
        var action_id = 0;
        while (action_id <= number_of_actions) {
            var action_id_entry = 0;
            action_data[action_id] = [];
            while (action_id_entry < ACTION_ENTRIES) {
                var action_entry_data;
                [_, action_entry_data, next] = number_pattern.exec(next);
                action_data[action_id][action_id_entry] = Number(action_entry_data);
                action_id_entry++;
            }
            action_id++;
        }
    }

    // Words
    {
        var word = 0;
        while (word < ((number_of_words + 1) * 2)) {
            var input;
            [_, input, next] = word_pattern.exec(next);
            if (!(Math.floor(word / 2) in list_of_verbs_and_nouns)) {
                list_of_verbs_and_nouns[Math.floor(word / 2)] = [];
            }
            list_of_verbs_and_nouns[Math.floor(word / 2)][word % 2] = input;
            word++;
        }
    }

    // Rooms
    {
        var room = 0;
        while (room <= number_of_rooms) {
            room_exit[room] = [];
            [_,
                room_exit[room][0], room_exit[room][1],
                room_exit[room][2], room_exit[room][3],
                room_exit[room][4], room_exit[room][5],
                room_description[room], next
            ] = room_pattern.exec(next);

            [ // Extracted as strings and need to be converted to numbers
                room_exit[room][0],
                room_exit[room][1],
                room_exit[room][2],
                room_exit[room][3],
                room_exit[room][4],
                room_exit[room][5]] = [
                    Number(room_exit[room][0]),
                    Number(room_exit[room][1]),
                    Number(room_exit[room][2]),
                    Number(room_exit[room][3]),
                    Number(room_exit[room][4]),
                    Number(room_exit[room][5])
                ];
            room++;
        }
    }

    // Messages
    {
        var current_message = 0;
        while (current_message <= number_of_messages) {
            [_, message[current_message], next] = text_pattern.exec(next);
            current_message++;
        }
    }

    // Objects
    {
        var object = 0;
        while (object <= number_of_objects) {
            [_, object_description[object], object_location[object], next] = object_pattern.exec(next);
            object_location[object] = Number(object_location[object]);
            object_original_location[object] = object_location[object];
            object++;
        }
    }

    // Action descriptions
    {
        var action_counter = 0;
        while (action_counter <= number_of_actions) {
            [_, action_description[action_counter], next] = text_pattern.exec(next);
            action_counter++;
        }
    }

    // Interpreter version
    [_, adventure_version, next] = number_pattern.exec(next);
    adventure_version = Number(adventure_version);

    // Adventure number
    [_, adventure_number, next] = number_pattern.exec(next);
    adventure_number = Number(adventure_number);

    // Replace Ascii 96 with Ascii 34 in output text strings
    const quote_pattern = new RegExp(`\``, `g`)
    var string_index;
    for (string_index in object_description) {
        object_description[string_index] = object_description[string_index].replace(quote_pattern, `"`);
    }
    for (string_index in message) {
        message[string_index] = message[string_index].replace(quote_pattern, `"`);
    }
    for (string_index in room_description) {
        room_description[string_index] = room_description[string_index].replace(quote_pattern, `"`);
    }

    return 1;
}

function cls() {
    process.stdout.write(ESCAPE_CHARACTER + `[2J`); // Clear the screen
    process.stdout.write(ESCAPE_CHARACTER + `[0;0H`); // Jump to coordinate 0, 0    
    return TRUE;
}

function extract_words() {
    // Input:
    // keyboard_input_2           : Input string
    // word_length                : Character length
    // list_of_verbs_and_nouns    : List of verbs and nouns
    // Output:
    // found_word : Identified verbs and nouns
    // extracted_input_words      : Extracted words from input
    extracted_input_words = [];
    keyboard_input_2 = keyboard_input_2.replace(/^\s*/, ``); // Remove leading spaces
    extracted_input_words = keyboard_input_2.split(/\s+/);

    if (typeof extracted_input_words[0] === 'undefined') {
        extracted_input_words[0] = ``;
    }

    resolve_go_shortcut();

    // Set noun to blank, if not defined
    if (extracted_input_words.length < 2) {
        extracted_input_words[1] = ``;
    }
    global_noun = extracted_input_words[1];

    {
        // Iterate over verbs and nouns
        var verb_or_noun = 0;
        while (verb_or_noun <= 1) {
            // Reset identified word id
            found_word[verb_or_noun] = 0;

            // Last non-synonym word id
            var non_synonym;
            {
                // Iterate through words
                var word_id = 0;
                for (word_id in list_of_verbs_and_nouns) {
                    var word = list_of_verbs_and_nouns[word_id];

                    if (word[verb_or_noun].substr(0, 1) !== `*`) {
                        non_synonym = word_id;
                    }
                    var temp_word = word[verb_or_noun];
                    temp_word = temp_word.replace(/^[*]/, ``);
                    temp_word = temp_word.substr(0, word_length);

                    if (temp_word === extracted_input_words[verb_or_noun].substr(0, word_length).toUpperCase()) {
                        found_word[verb_or_noun] = Number(non_synonym);
                        break;
                    }
                }
            }
            verb_or_noun++;
        }
    }
    return 1;
}

function save_game(save_filename) {
    var save_data = [];

    // A bit of extra precaution
    save_data.push(adventure_version);
    save_data.push(adventure_number);

    var field_index;
    save_data.push(current_room);
    for (field_index in alternate_room) {
        save_data.push(alternate_room[field_index]);
    }

    save_data.push(counter_register);
    for (field_index in alternate_counter) {
        save_data.push(alternate_counter[field_index]);
    }
    for (field_index in object_location) {
        save_data.push(object_location[field_index]);
    }
    // Status flag booleans need to be converted to numbers
    for (field_index in status_flag) {
        if (status_flag[field_index] === TRUE) {
            save_data.push(TRUE_VALUE);
        } else {
            save_data.push(FALSE_VALUE);
        }
    }

    try {
        file_content = fs.writeFileSync(save_filename, save_data.join(INPUT_RECORD_SEPARATOR));
    } catch (e) {
        console.log('Error:', e.stack);
        return FALSE;
    }
    return TRUE;
}

function load_game(save_filename) {
    var file_content;

    if (fs.existsSync(save_filename)) {
        try {
            file_content = fs.readFileSync(save_filename, `utf8`);
        } catch (e) {
            console.log('Error:', e.stack);
            return FALSE;
        }
    } else {
        console.log(`Couldn't load "${save_filename}". Doesn't exist!`);
        return FALSE;
    }

    // Define pattern for finding three types of newlines
    const unix = `(?<![\\x0d])[\\x0a](?![\\x0d])`;
    const apple = `(?<![\\x0a])[\\x0d](?![\\x0a])`;
    const dos = `(?<![\\x0d])[\\x0d][\\x0a](?![\\x0a])`;
    const newline_pattern = new RegExp(`${unix}|${apple}|${dos}`, `g`)

    var save_data = file_content.split(newline_pattern);

    // A bit of extra precaution
    var save_adventure_version = Number(save_data.shift());
    if (save_adventure_version !== adventure_version) {
        console.log(`Invalid savegame version`);
        return FALSE;
    }
    var save_adventure_number = Number(save_data.shift());
    if (save_adventure_number !== adventure_number) {
        console.log(`Invalid savegame adventure number`);
        return FALSE;
    }

    var field_index;
    current_room = Number(save_data.shift());
    for (field_index in alternate_room) {
        alternate_room[field_index] = Number(save_data.shift());
    }
    counter_register = Number(save_data.shift());
    for (field_index in alternate_counter) {
        alternate_counter[field_index] = Number(save_data.shift());
    }
    for (field_index in object_location) {
        object_location[field_index] = Number(save_data.shift());
    }
    // Status flag numbers need to be converted to booleans
    for (field_index in status_flag) {
        var read_value = Number(save_data.shift());
        if (read_value === TRUE_VALUE) {
            status_flag[field_index] = TRUE;
        } else {
            status_flag[field_index] = FALSE;
        }
    }

    return TRUE;
}

function run_actions(input_verb, input_noun) {
    // If verb is 'GO' and noun is a direction
    if (input_verb === VERB_GO && input_noun <= DIRECTION_NOUNS) {
        handle_go_verb();
        return 1;
    }

    var found_word = 0;
    cont_flag = FALSE;
    var current_action = 0;
    var word_action_done = FALSE;
    for (current_action in action_data) {
        var action_verb = get_action_verb(current_action);
        var action_noun = get_action_noun(current_action);

        // CONT action
        if (cont_flag && (action_verb === 0) && (action_noun === 0)) {
            print_debug(`Action ${current_action}. verb ${action_verb}, noun ${action_noun} (CONT ${cont_flag}), \"${action_description[current_action]}\"`, 31);
            if (evaluate_conditions(current_action)) {
                execute_commands(current_action);
            }
        } else {
            // "CONT" condition failures won't reset the CONT flag!
            cont_flag = FALSE;
        }

        // AUT action
        if (input_verb === 0) {
            if ((action_verb === 0) && (action_noun > 0)) {
                print_debug(`Action ${current_action}. verb ${action_verb}, noun ${action_noun} (CONT ${cont_flag}), \"${action_description[current_action]}\"`, 31); cont_flag = FALSE;
                if ((Math.floor(Math.random() * PERCENT_UNITS)) <= action_noun) {
                    if (evaluate_conditions(current_action)) {
                        execute_commands(current_action);
                    }
                }
            }
        }

        // Word action
        if (input_verb > 0) {
            if (action_verb === input_verb) {
                if (word_action_done === FALSE) {
                    print_debug(
                        `Action ${current_action}. `
                        + `verb ${action_verb} (`
                        + list_of_verbs_and_nouns[action_verb][0] + `), `
                        + `noun ${action_noun} (`
                        + list_of_verbs_and_nouns[action_noun][1]
                        + `) (CONT ${cont_flag}), `
                        + `\"${action_description[current_action]}\"`,
                        31
                    );
                    cont_flag = FALSE;
                    if (action_noun === 0) {
                        found_word = 1;
                        if (evaluate_conditions(current_action)) {
                            execute_commands(current_action);
                            word_action_done = TRUE;
                            if (cont_flag === FALSE) { return 1; }
                        }
                    } else if (action_noun === input_noun) {
                        found_word = 1;
                        if (evaluate_conditions(current_action)) {
                            execute_commands(current_action);
                            word_action_done = TRUE;
                            if (cont_flag === FALSE) { return 1; }
                        }
                    }
                }
            }
        }
    }

    if (input_verb === 0) { return 1; }

    if (!word_action_done) {
        if (handle_carry_and_drop_verb(input_verb, input_noun)) {
            return TRUE;
        }
    }

    if (word_action_done === TRUE) { return TRUE; }

    if (found_word) {
        console.log(`I can't do that yet\n`);
    }
    else {
        console.log(`I don't understand your command\n`);
    }

    return TRUE;
}

// Subroutine for optionally printing debug messages
function print_debug(message, color) {
    if (flag_debug) {
        console.log(ESCAPE_CHARACTER + `[` + color + `mDEBUG: ${message}` + ESCAPE_CHARACTER + `[0m`)
    }
}

function noun_is_in_object() {
    var truncated_noun = global_noun.substr(0, word_length);
    const object_noun_pattern = new RegExp(`/(.*)/$`);
    for (object_index in object_description) {
        var description = object_description[object_index];
        var match_result = description.match(object_noun_pattern);
        if (match_result !== null) {
            var object_noun = match_result[1].toLowerCase();
            if (object_noun === truncated_noun) {
                return TRUE;
            }
        }
    }
    return FALSE;
}

function handle_carry_and_drop_verb(input_verb, input_noun) {
    // Exit subroutine if the verb isn't carry or drop
    if (!(input_verb === VERB_CARRY) && !(input_verb === VERB_DROP)) {
        return 0;
    }

    // If noun is undefined, return with an error text
    if ((input_noun === 0) && !noun_is_in_object()) {
        console.log(`What?`);
        return 1;
    }

    // If verb is CARRY, check that we're not exceeding weight limit
    if (input_verb == VERB_CARRY) {
        carried_objects = 0;

        for (current_location in object_location) {
            if (object_location[current_location] === ROOM_INVENTORY) {
                carried_objects++;
            }
        }

        if (carried_objects >= max_objects_carried) {
            if (max_objects_carried >= 0) {
                console.log(`I've too much too carry. try -take inventory-`);
                return 1;
            }
        } else {
            if (get_or_drop_noun(input_noun, current_room, ROOM_INVENTORY)) {
                return TRUE;
            } else {
                console.log(`I don't see it here`);
                return TRUE;
            }
        }
    } else {
        if (get_or_drop_noun(input_noun, ROOM_INVENTORY, current_room)) {
            return TRUE;
        } else {
            console.log(`I'm not carrying it`);
            return TRUE;
        }
    }
    return 0;
}

function get_or_drop_noun(input_noun, room_source, room_destination) {
    var objects_in_room = [];

    // Identify all objects in current room
    for (object_counter in object_location) {
        var location = object_location[object_counter];
        if (location === room_source) {
            objects_in_room.push(object_counter);
        }
    }

    // Check if any of the objects in the room has a matching noun
    const object_noun_pattern = new RegExp(`/(.*)/$`);
    for (object_index in objects_in_room) {
        var room_object = objects_in_room[object_index];

        // Only proceed if the object has a noun defined
        var match_result = object_description[room_object].match(object_noun_pattern);
        if (match_result !== null) {
            // Pick up the first object we find that matches and return
            if ((list_of_verbs_and_nouns[input_noun][1] === match_result[1]) || (match_result[1] === global_noun.substr(0, word_length).toUpperCase())) {
                object_location[room_object] = room_destination;
                console.log(`OK`);
                return TRUE;
            }
        }
    }
    return FALSE;
}

function get_action_verb(action_id) {
    return Math.floor(action_data[action_id][0] / COMMAND_CODE_DIVISOR);
}

function get_action_noun(action_id) {
    return action_data[action_id][0] % COMMAND_CODE_DIVISOR;
}

function execute_commands(action_id) {
    command_parameter_index = 1;
    {
        var command = 0;
        var continue_executing_commands = [];
        continue_executing_commands.value = TRUE;
        while (command < COMMANDS_IN_ACTION && continue_executing_commands) {
            command_or_display_message = decode_command_from_data(command, action_id);
            command++;

            // Code above 102? it's printable text!
            if (command_or_display_message >= MESSAGE_2_START) {
                print_debug(
                    `Command print message ` + command_or_display_message,
                    32);
                console.log(message[command_or_display_message - MESSAGE_1_END + 1]);
            }

            // Do nothing
            else if (command_or_display_message === 0) { }

            // Code below 52? it's printable text!
            else if (command_or_display_message <= MESSAGE_1_END) {
                print_debug(
                    `Command print message ` + command_or_display_message,
                    32);
                console.log(message[command_or_display_message]);
            }

            // Code above 52 and below 102? We got some command code to run!
            else {
                var command_code = command_or_display_message - MESSAGE_1_END - 1;

                // Launch execution of action commands
                print_debug(
                    `Command code ${command_code} `
                    + command_name[command_code],
                    32
                );
                command_function[command_code](action_id, continue_executing_commands);
            }
        }
    }
    return 1;
}

function evaluate_conditions(action_id) {
    var evaluation_status = 1;
    var condition = 1;
    while (condition <= CONDITIONS) {
        var condition_code = get_condition_code(action_id, condition);
        var condition_parameter = get_condition_parameter(action_id, condition);
        print_debug(
            `Condition ${condition_code} `
            + condition_name[condition_code]
            + ` with parameter ${condition_parameter}`,
            33
        );
        if (!condition_function[condition_code](condition_parameter)) {
            // Stop evaluating conditions if false. One fails all.
            evaluation_status = 0;
            break;
        }
        condition++;
    }
    return evaluation_status;
}

function get_condition_code(action_id, condition) {
    var condition_raw = action_data[action_id][condition];
    var condition_code = condition_raw % CONDITION_DIVISOR;
    return condition_code;
}

function get_condition_parameter(action_id, condition) {
    var condition_raw = action_data[action_id][condition];
    var condition_parameter = Math.floor(condition_raw / CONDITION_DIVISOR);
    return condition_parameter;
}

function resolve_go_shortcut() {
    var entered_input_verb = extracted_input_words[0].toLowerCase();
    // Don't make shortcut if input verb matches legitimate word action
    var viable_phrases = get_viable_word_actions();

    for (viable_verb in viable_phrases) {
        var possible_verb_text = list_of_verbs_and_nouns[viable_verb][0].toLowerCase();
        var shortened_verb = entered_input_verb.substr(0, possible_verb_text.length);
        if (shortened_verb === possible_verb_text) {
            return 1;
        }
    }

    var direction;
    for (direction = 0; direction <= DIRECTION_NOUNS; direction++) {
        var direction_noun_text = list_of_verbs_and_nouns[direction][1].toLowerCase();
        var shortened_direction = direction_noun_text.substr(0, entered_input_verb.length);
        if (entered_input_verb === shortened_direction) {
            extracted_input_words[0] = list_of_verbs_and_nouns[VERB_GO][0].toLowerCase();
            extracted_input_words[1] = direction_noun_text;
            return 1;
        }
    }
    return 1;
}

// Evaluate all conditions in all actions, and save verbs and nouns for the
// actions with conditions that would succeed
function get_viable_word_actions() {
    var viable_phrases = {};
    var current_action = 0;
    for (current_action in action_data) {
        var action_verb = get_action_verb(current_action);
        var action_noun = get_action_noun(current_action);
        if (action_verb > 0) {
            if (evaluate_conditions(current_action)) {
                if (viable_phrases[action_verb] === undefined) {
                    viable_phrases[action_verb] = {};
                }
                viable_phrases[action_verb][action_noun] = ``;
            }
        }

    }
    return viable_phrases;
}
