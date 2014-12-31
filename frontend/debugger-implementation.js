(function() {
'use strict';

if (typeof window != 'undefined' && !window.location.origin) {
  window.location.origin =
      window.location.protocol + "//" +
      window.location.hostname +
      (window.location.port ? (':' + window.location.port) : '');
}


// SIDE BAR

var SIDE_BAR_ID = "elm-reactor-side-bar";
var SIDE_BAR_BODY_ID = "elm-reactor-side-bar-body";
var SIDE_BAR_WIDTH = 275;

var DARK_GREY = "#4A4A4A";
var LIGHT_GREY = "#E4E4E4";

function createSideBar() {
    var debuggingPanelExpanded = true;

    var sideBar = document.createElement("div");
    sideBar.id = SIDE_BAR_ID;

    var sideBarBody = document.createElement("div");
    sideBarBody.id = SIDE_BAR_BODY_ID;
    sideBarBody.style.overflow = "hidden";
    sideBarBody.style.height = "100%";

    // Create and style the panel
    sideBar.style.background = DARK_GREY;
    sideBar.style.width = SIDE_BAR_WIDTH + "px";
    sideBar.style.height = "100%";
    sideBar.style.position = "absolute";
    sideBar.style.top = "0px";
    sideBar.style.right = "0px";
    sideBar.style.transitionDuration = "0.3s";
    sideBar.style.opacity = 0.97;
    sideBar.style.zIndex = 1;

    // Prevent clicks from reaching the main elm instance under the panel
    sideBar.addEventListener("click", blockClicks);
    function blockClicks(e) {
        var event = e || window.event;
        event.cancelBubble = true;
        if (event.stopPropagation) {
            event.stopPropagation();
        }
    }

    // Create and style the button
    var tabWidth = 25;
    var sideBarTab = document.createElement("div");
    sideBarTab.id = "debugToggle";
    sideBarTab.style.position = "absolute";
    sideBarTab.style.width = tabWidth + "px";
    sideBarTab.style.height = "60px";
    sideBarTab.style.top = "50%";
    sideBarTab.style.left = "-" + tabWidth + "px";
    sideBarTab.style.borderTopLeftRadius = "3px";
    sideBarTab.style.borderBottomLeftRadius = "3px";
    sideBarTab.style.background = DARK_GREY;


    // Wire the button
    sideBarTab.onclick = function() {
        var toolPanel = document.getElementById(SIDE_BAR_ID);
        if (debuggingPanelExpanded){
            toolPanel.style.width = "0px";
            debuggingPanelExpanded = false;
        } else {
            toolPanel.style.right = "0px";
            toolPanel.style.width = SIDE_BAR_WIDTH + "px";
            debuggingPanelExpanded = true;
        }
    };

    sideBar.appendChild(sideBarTab);
    sideBar.appendChild(sideBarBody);
    return sideBar;
}


// ERROR MESSAGE

var ERROR_MESSAGE_ID = 'elm-reactor-error-message';

function initErrorMessage(message) {
    var node = document.createElement("pre");
    node.id = ERROR_MESSAGE_ID;
    node.innerHTML = message;
    node.style.zindex = 1;
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.color = DARK_GREY;
    node.style.backgroundColor = LIGHT_GREY;
    node.style.padding = "1em";
    node.style.margin = "1em";
    node.style.borderRadius = "10px";
    return node;
}


// EVENT BLOCKER

var EVENT_BLOCKER_ID = 'elm-reactor-event-blocker'

var eventsToIgnore = [
    "click", "mousemove", "mouseup", "mousedown", "mouseclick", "keydown",
    "keypress", "keyup", "touchstart", "touchend", "touchcancel", "touchleave",
    "touchmove", "pointermove", "pointerdown", "pointerup", "pointerover",
    "pointerout", "pointerenter", "pointerleave", "pointercancel"
];

function ignore(e) {
    var event = e || window.event;
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    if (event.cancelBubble !== null) {
        event.cancelBubble = true;
    }
    if (event.preventDefault) {
        event.preventDefault();
    }
    return false;
}

function initEventBlocker() {
    var node = document.createElement("div");
    node.id = EVENT_BLOCKER_ID;
    node.style.position = "absolute";
    node.style.top = "0px";
    node.style.left = "0px";
    node.style.width = "100%";
    node.style.height = "100%";

    for (var i = eventsToIgnore.length; i-- ;) {
        node.addEventListener(eventsToIgnore[i], ignore, true);
    }

    return node;
}

function addEventBlocker(node) {
    if (!document.getElementById(EVENT_BLOCKER_ID)) {
        node.appendChild(initEventBlocker());
    }
}

function removeEventBlocker() {
    var blocker = document.getElementById(EVENT_BLOCKER_ID);
    blocker.parentNode.removeChild(blocker);
}



// CODE TO SET UP A MODULE FOR DEBUGGING

Elm.fullscreenDebug =
  fullscreenDebugWithOptions({ externalSwap: false });

Elm.fullscreenDebugWithOptions =
  fullscreenDebugWithOptions;


function fullscreenDebugWithOptions(options) {

    return function(elmModule, elmModuleFile) {
        var createdSocket = false;
        var elmPermitSwaps = true;

        var mainHandle = initModuleWithDebugState(elmModule); // TODO: emptyDebugState());
        var sideBar = initSideBar();
        if (!options.externalSwap) {
            initSocket();
        }

        parent.window.addEventListener("message", function(e) {
            if (e.data === "elmNotify") {
                var currentPosition = mainHandle.debugger.getMaxSteps();
                if (sideBar.ports) {
                    sideBar.ports.eventCounter.send(currentPosition);
                    sendWatches(currentPosition);
                }
            }
        }, false);

        function initSideBar() {
            document.body.appendChild(createSideBar());

            var sideBar = Elm.embed(Elm.SideBar, document.getElementById(SIDE_BAR_BODY_ID), {
                eventCounter: 0,
                watches: [],
                showSwap: !options.externalSwap
            });

            sideBar.ports.scrubTo.subscribe(function(position) {
                if (mainHandle.debugger.isPaused()) {
                    mainHandle.debugger.stepTo(position);
                    sendWatches(position);
                }
            });

            sideBar.ports.pause.subscribe(function(pause) {
                if (pause) {
                    mainHandle.debugger.pause();
                } else {
                    mainHandle.debugger.kontinue();
                }
            });

            sideBar.ports.restart.subscribe(function() {
                mainHandle.debugger.restart();
                sendWatches(0);
            });

            sideBar.ports.permitSwap.subscribe(function(permitSwaps) {
                elmPermitSwaps = permitSwaps;
            });

            return sideBar;
        }

        function sendWatches(position) {
            var separator = "  ";
            var output = [];

            var watchAtPoint = mainHandle.debugger.watchTracker.frames[position];

            for (var key in watchAtPoint) {
                var value = watchAtPoint[key];
                // The toString object is defined in toString.js
                // and is prepended to this file at build time.
                var stringified = prettyPrint(value, separator);
                output.push([key, stringified]);
            }
            sideBar.ports.watches.send(output);
        }

        function initSocket() {
            createdSocket = true;
            // "/todo.html" => "todo.elm"
            elmModuleFile = elmModuleFile || window.location.pathname.substr(1).split(".")[0] + ".elm";
            var socketLocation = "ws://" + window.location.host + "/socket?file=" + elmModuleFile;
            var serverConnection = new WebSocket(socketLocation);
            serverConnection.onmessage = function(event) {
                if (elmPermitSwaps && sideBar.ports) {
                    swap(event.data);
                }
            };
            window.addEventListener("unload", function() {
                serverConnection.close();
            });
        }

        function swap(rawJsonResponse) {
            var error = document.getElementById(ERROR_MESSAGE_ID);
            if (error) {
                error.parentNode.removeChild(error);
            }

            var result = JSON.parse(rawJsonResponse);

            if (result.code) {
                window.eval(result.code);
                var elmModule = window.eval('Elm.' + result.name);
                if (mainHandle.debugger) {
                    var debugState = mainHandle.debugger.getDebugState();
                    mainHandle.debugger.dispose();
                    mainHandle.dispose();

                    mainHandle = initModuleWithDebugState(elmModule, debugState);

                    removeEventBlocker();
                }
                else {
                    mainHandle = mainHandle.swap(elmModule);
                }
            } else if (result.error) {
                document.body.appendChild(initErrorMessage(result.error));
            }
        }

        if (options.externalSwap) {
            mainHandle.debugger.swap = swap;
        }
        return mainHandle;
    };
};


function initModuleWithDebugState(elmModule, debugState /* =undefined */) {
    var exposedDebugger = {};

    function debuggerAttach(elmModule, debugState) {
        function make(runtime) {
            var wrappedModule = initModule(elmModule, runtime);
            exposedDebugger = debuggerInit(wrappedModule, runtime, debugState);
            return wrappedModule.debuggedModule;
        }
        return { make: make };
    }

    var mainHandle = Elm.fullscreen(debuggerAttach(elmModule, debugState));
    mainHandle.debugger = exposedDebugger;
    return mainHandle;
}


var EVENTS_PER_SAVE = 100;


function emptyDebugState() {
    return {
        paused: false,
        pausedAtTime: 0,
        totalTimeLost: 0,

        index: 0,
        events: [],
        watches: {},
        snapshots: [],
        asyncCallbacks: [],

        performSwaps: true
    };
}


function initModule(elmModule, runtime) {
    var debugState = emptyDebugState();
    var watchTracker = Elm.Native.Debug.make(runtime).watchTracker;
    var eventsUntilSnapshot = EVENTS_PER_SAVE;
    runtime.debuggerStatus = runtime.debuggerStatus || {};
    runtime.debuggerStatus.eventCounter = runtime.debuggerStatus.eventCounter || 0;

    // runtime is the prototype of wrappedRuntime
    // so we can access all runtime properties too
    var wrappedRuntime = Object.create(runtime);
    wrappedRuntime.notify = notifyWrapper;
    wrappedRuntime.setTimeout = setTimeoutWrapper;

    // make a copy of the wrappedRuntime
    var assignedPropTracker = Object.create(wrappedRuntime);
    var debuggedModule = elmModule.make(assignedPropTracker);

    // make sure the signal graph is actually a signal & extract the visual model
    if ( !('recv' in debuggedModule.main) ) {
        debuggedModule.main =
            Elm.Signal.make(runtime).constant(debuggedModule.main);
    }

    // The main module stores imported modules onto the runtime.
    // To ensure only one instance of each module is created,
    // we assign them back on the original runtime object.
    Object.keys(assignedPropTracker).forEach(function(key) {
        runtime[key] = assignedPropTracker[key];
    });

    var signalGraphNodes = flattenSignalGraph(wrappedRuntime.inputs);
    var tracePath = tracePathInit(runtime, debuggedModule.main);

    debugState.snapshots.push(snapshotSignalGraph(signalGraphNodes));

    function notifyWrapper(id, v) {
        var timestep = runtime.timer.now();

        // Ignore all events that occur while the program is paused.
        if (debugState.paused) {
            return false;
        }

        // Record the event
        watchTracker.pushFrame();
        debugState.events.push({ id:id, value:v, timestep:timestep });
        runtime.debuggerStatus.eventCounter += 1;

        var changed = runtime.notify(id, v, timestep);
        snapshotOnCheckpoint();
        if (parent.window) {
            parent.window.postMessage("elmNotify", window.location.origin);
        }
        return changed;
    }

    function setTimeoutWrapper(thunk, delay) {
        if (debugState.paused) {
            // Don't push timers and such to the callback stack while we're paused.
            // It causes too many callbacks to be fired during unpausing.
            return 0;
        }
        var callback = {
            thunk: thunk,
            id: 0,
            executed: false
        };

        callback.id = setTimeout(function() {
            callback.executed = true;
            thunk();
        }, delay);

        debugState.asyncCallbacks.push(callback);
        return callback.id;
    }

    function clearAsyncCallbacks() {
        debugState.asyncCallbacks.forEach(function(callback) {
            if (!callback.executed) {
              clearTimeout(callback.id);
            }
        });
    }

    function clearRecordedEvents() {
        debugState.events = [];
        runtime.debuggerStatus.eventCounter = 0;
    }

    function loadRecordedEvents(events) {
        debugState.events = events.slice();
    }

    function clearSnapshots() {
        debugState.snapshots = [snapshotSignalGraph(signalGraphNodes)];
    }

    function getSnapshotAt(i) {
        var snapshotEvent = Math.floor(i / EVENTS_PER_SAVE);
        assert(
            snapshotEvent < debugState.snapshots.length && snapshotEvent >= 0,
            "Out of bounds index: " + snapshotEvent);
        return debugState.snapshots[snapshotEvent];
    }

    function snapshotOnCheckpoint() {
        if (eventsUntilSnapshot === 1) {
            debugState.snapshots.push(snapshotSignalGraph(signalGraphNodes));
            eventsUntilSnapshot = EVENTS_PER_SAVE;
        } else {
            eventsUntilSnapshot -= 1;
        }
    }

    function setPaused() {
        debugState.paused = true;
        clearAsyncCallbacks();
        debugState.pausedAtTime = Date.now();
        tracePath.stopRecording();
        addEventBlocker(runtime.node);
    }

    function setContinue(position) {
        var pauseDelay = Date.now() - debugState.pausedAtTime;
        runtime.timer.addDelay(pauseDelay);
        debugState.paused = false;

        // we need to dump the events that are ahead of where we're continuing.
        var lastSnapshotPosition = Math.floor(position / EVENTS_PER_SAVE);
        eventsUntilSnapshot = EVENTS_PER_SAVE - (position % EVENTS_PER_SAVE);
        debugState.snapshots = debugState.snapshots.slice(0, lastSnapshotPosition + 1);

        if (position < debugState.events.length) {
            var lastEventTime = debugState.events[position].timestep;
            var scrubTime = runtime.timer.now() - lastEventTime;
            runtime.timer.addDelay(scrubTime);
        }

        debugState.events = debugState.events.slice(0, position);
        tracePath.clearTracesAfter(position);
        runtime.debuggerStatus.eventCounter = position;
        executeCallbacks(debugState.asyncCallbacks);
        removeEventBlocker();

        tracePath.startRecording();
    }

    function isPaused() {
        return debugState.paused;
    }

    return {
        debuggedModule: debuggedModule,
        signalGraphNodes: signalGraphNodes,
        initialSnapshot: snapshotSignalGraph(signalGraphNodes),
        initialAsyncCallbacks: debugState.asyncCallbacks.slice(),
        // API functions
        clearAsyncCallbacks: clearAsyncCallbacks,
        clearRecordedEvents: clearRecordedEvents,
        recordedEvents: debugState.events,
        loadRecordedEvents: loadRecordedEvents,
        clearSnapshots: clearSnapshots,
        getSnapshotAt: getSnapshotAt,
        snapshotOnCheckpoint: snapshotOnCheckpoint,
        isPaused: isPaused,
        setPaused: setPaused,
        setContinue: setContinue,
        tracePath: tracePath,
        watchTracker: watchTracker
    };
}

// The debugState variable is passed in on swap. It represents
// the a state of the debugger for it to assume during init. It contains
// the paused state of the debugger, the recorded events, and the current
// event being processed.
function debuggerInit(elmModule, runtime, debugState /* =undefined */) {
    var currentEventIndex = 0;

    function resetProgram(position) {
        var closestSnapshot = elmModule.getSnapshotAt(position);
        elmModule.clearAsyncCallbacks();
        restoreSnapshot(elmModule.signalGraphNodes, closestSnapshot);
        redrawGraphics();
    }

    function restartProgram() {
        pauseProgram();
        resetProgram(0);
        elmModule.watchTracker.clear();
        elmModule.tracePath.clearTraces();
        elmModule.setContinue(0);
        elmModule.clearRecordedEvents();
        elmModule.clearSnapshots();
        executeCallbacks(elmModule.initialAsyncCallbacks);
    }

    function pauseProgram() {
        elmModule.setPaused();
        currentEventIndex = elmModule.recordedEvents.length;
    }

    function continueProgram() {
        if (elmModule.isPaused()) {
            var closestSnapshotIndex =
                Math.floor(currentEventIndex / EVENTS_PER_SAVE) * EVENTS_PER_SAVE;
            resetProgram(currentEventIndex);
            var continueIndex = currentEventIndex;
            currentEventIndex = closestSnapshotIndex;
            stepTo(continueIndex);
            elmModule.setContinue(currentEventIndex);
        }
    }

    function stepTo(index) {
        if (!elmModule.isPaused()) {
            elmModule.setPaused();
            resetProgram();
        }

        if (index < 0 || index > getMaxSteps()) {
            throw "Index out of bounds: " + index;
        }

        if (index < currentEventIndex) {
            var closestSnapshotIndex = Math.floor(index / EVENTS_PER_SAVE) * EVENTS_PER_SAVE;
            resetProgram(index);
            currentEventIndex = closestSnapshotIndex;
        }

        while (currentEventIndex < index) {
            var nextEvent = elmModule.recordedEvents[currentEventIndex];
            runtime.notify(nextEvent.id, nextEvent.value, nextEvent.timestep);

            currentEventIndex += 1;
        }
    }

    function getMaxSteps() {
        return elmModule.recordedEvents.length;
    }

    function redrawGraphics() {
        var main = elmModule.debuggedModule.main
        for (var i = main.kids.length ; i-- ; ) {
            main.kids[i].recv(runtime.timer.now(), true, main.id);
        }
    }

    function getDebugState() {
        var continueIndex = currentEventIndex;
        if (!elmModule.isPaused()) {
            continueIndex = getMaxSteps();
        }
        return {
            paused: elmModule.isPaused(),
            recordedEvents: elmModule.recordedEvents.slice(),
            currentEventIndex: continueIndex
        };
    }

    function dispose() {
        var parentNode = runtime.node.parentNode;
        parentNode.removeChild(elmModule.tracePath.canvas);
        parentNode.removeChild(runtime.node);
    }

    if (debugState) {
        // The problem is that we want to previous paused state. But
        // by the time JS reaches here, the old code has been swapped out
        // and the new modules are being generated. So we can ask the
        // debugging console what it thinks the pause state is and go
        // from there.
        var paused = debugState.paused;
        elmModule.setPaused();
        elmModule.loadRecordedEvents(debugState.recordedEvents);
        var index = getMaxSteps();
        runtime.debuggerStatus.eventCounter = 0;
        elmModule.tracePath.clearTraces();

        // draw new trace path
        elmModule.tracePath.startRecording();
        while(currentEventIndex < index) {
            var nextEvent = elmModule.recordedEvents[currentEventIndex];
            runtime.debuggerStatus.eventCounter += 1;
            runtime.notify(nextEvent.id, nextEvent.value, nextEvent.timestep);
            elmModule.snapshotOnCheckpoint();
            currentEventIndex += 1;
        }
        elmModule.tracePath.stopRecording();

        stepTo(debugState.currentEventIndex);
        if (!paused) {
            elmModule.setContinue(debugState.currentEventIndex);
        }
    }

    runtime.node.parentNode.appendChild(elmModule.tracePath.canvas);

    var elmDebugger = {
        restart: restartProgram,
        pause: pauseProgram,
        kontinue: continueProgram,
        getMaxSteps: getMaxSteps,
        stepTo: stepTo,
        isPaused: elmModule.isPaused,
        getDebugState: getDebugState,
        dispose: dispose,
        allNodes: elmModule.signalGraphNodes,
        watchTracker: elmModule.watchTracker
    };

    return elmDebugger;
}

function Point(x, y) {
    this.x = x;
    this.y = y;

    this.translate = function(x, y) {
        return new Point(this.x + x, this.y + y);
    }
}

function tracePathInit(runtime, signalGraphMain) {
    var List = Elm.List.make(runtime);
    var Signal = Elm.Signal.make(runtime);
    var tracePathNode = A2(Signal.map, graphicsUpdate, signalGraphMain);
    var tracePathCanvas = createCanvas();
    var tracePositions = {};
    var recordingTraces = true;

    function findPositions(currentScene) {
        var positions = {};
        function processElement(elem, offset) {
            if (elem.element.ctor == "Custom" && elem.element.type == "Collage")
            {
                List.map(F2(processForm)(offset))(elem.element.model.forms);
            }
        }

        function processForm(offset, form) {
            if (form.form.ctor == "FElement")
            {
                processElement(form.form._0, offset.translate(form.x, -form.y));
            }
            if (form.form.ctor == "FGroup")
            {
                var newOffset = offset.translate(form.x, -form.y);
                List.map(F2(processForm)(newOffset))(form.form._1);
            }
            if (form.debugTracePathId)
            {
                positions[form.debugTracePathId] = new Point(form.x + offset.x, -form.y + offset.y);
            }
        }

        processElement(currentScene, new Point(0, 0));
        return positions;
    }

    function appendPositions(positions) {
        for (var id in positions) {
            var pos = positions[id];
            if (tracePositions.hasOwnProperty(id)) {
               tracePositions[id].push(pos);
            }
            else {
                tracePositions[id] = [pos];
            }
            if (tracePositions[id].length < runtime.debuggerStatus.eventCounter) {
                var padCount = runtime.debuggerStatus.eventCounter - tracePositions[id].length;
                var lastTracePosition = tracePositions[id][tracePositions[id].length - 1];
                for (var i = padCount; i--;) {
                    tracePositions[id].push(lastTracePosition)
                }
            }
            assert(
                tracePositions[id].length === runtime.debuggerStatus.eventCounter,
                "We don't have a 1-1 mapping of trace positions to events");
        }
    }

    function graphicsUpdate(currentScene) {
        if (!recordingTraces) {
            return;
        }

        var ctx = tracePathCanvas.getContext('2d');
        ctx.clearRect(0, 0, tracePathCanvas.width, tracePathCanvas.height);

        ctx.save();
        ctx.translate(ctx.canvas.width/2, ctx.canvas.height/2);
        appendPositions(findPositions(currentScene));
        for (var id in tracePositions)
        {
            ctx.beginPath();
            var points = tracePositions[id];
            for (var i=0; i < points.length; i++)
            {
                var p = points[i];
                if (i == 0) {
                    ctx.moveTo(p.x, p.y);
                }
                else {
                    ctx.lineTo(p.x, p.y);
                }
            }
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(50, 50, 50, 0.4)";
            ctx.stroke();
        }

        ctx.restore();
    }

    function clearTraces() {
        tracePositions = {};
    }

    function stopRecording() {
        recordingTraces = false;
    }

    function startRecording() {
        recordingTraces = true;
    }

    function clearTracesAfter(position) {
        var newTraces = {};
        for (var id in tracePositions) {
            newTraces[id] = tracePositions[id].slice(0,position);
        }
        tracePositions = newTraces;
    }

    return {
        graphicsUpdate: graphicsUpdate,
        canvas: tracePathCanvas,
        clearTraces: clearTraces,
        clearTracesAfter: clearTracesAfter,
        stopRecording: stopRecording,
        startRecording: startRecording
    };
}

function executeCallbacks(callbacks) {
    callbacks.forEach(function(callback) {
        if (!callback.executed) {
            callback.executed = true;
            callback.thunk();
        }
    });
}

function createCanvas() {
    var canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    return canvas;
}

function assert(bool, msg) {
    if (!bool) {
        throw new Error("Assertion error: " + msg);
    }
}

function snapshotSignalGraph(signalGraphNodes) {
    var nodeValues = [];

    signalGraphNodes.forEach(function(node) {
        nodeValues.push({ value: node.value, id: node.id });
    });

    return nodeValues;
}

function restoreSnapshot(signalGraphNodes, snapshot) {
    assert(
        signalGraphNodes.length == snapshot.length,
        "saved program state has wrong length");

    for (var i=0; i < signalGraphNodes.length; i++) {
        var node = signalGraphNodes[i];
        var state = snapshot[i];
        assert(node.id == state.id, "the nodes moved position");

        node.value = state.value;
    }
}

function flattenSignalGraph(nodes) {
    var nodesById = {};

    function addAllToDict(node) {
        nodesById[node.id] = node;
        node.kids.forEach(addAllToDict);
    }
    nodes.forEach(addAllToDict);

    var allNodes = Object.keys(nodesById).sort().map(function(key) {
        return nodesById[key];
    });
    return allNodes;
}


// PRETTY PRINT VALUES

var prettyPrint = function(){

    var independentRuntime = {};
    var List;
    var ElmArray;
    var Dict;

    var toString = function(v, separator) {
        var type = typeof v;
        if (type === "function") {
            var name = v.func ? v.func.name : v.name;
            return '<function' + (name === '' ? '' : ': ') + name + '>';
        } else if (type === "boolean") {
            return v ? "True" : "False";
        } else if (type === "number") {
            return v.toFixed(2).replace(/\.0+$/g, '');
        } else if ((v instanceof String) && v.isChar) {
            return "'" + addSlashes(v) + "'";
        } else if (type === "string") {
            return '"' + addSlashes(v) + '"';
        } else if (type === "object" && '_' in v && probablyPublic(v)) {
            var output = [];
            for (var k in v._) {
                for (var i = v._[k].length; i--; ) {
                    output.push(k + " = " + toString(v._[k][i], separator));
                }
            }
            for (var k in v) {
                if (k === '_') continue;
                output.push(k + " = " + toString(v[k], separator));
            }
            if (output.length === 0) return "{}";
            var body = "\n" + output.join(",\n");
            return "{" + body.replace(/\n/g,"\n" + separator) + "\n}";
        } else if (type === "object" && 'ctor' in v) {
            if (v.ctor.substring(0,6) === "_Tuple") {
                var output = [];
                for (var k in v) {
                    if (k === 'ctor') continue;
                    output.push(toString(v[k], separator));
                }
                return "(" + output.join(", ") + ")";
            } else if (v.ctor === "_Array") {
                if (!ElmArray) {
                    ElmArray = Elm.Array.make(independentRuntime);
                }
                var list = ElmArray.toList(v);
                return "Array.fromList " + toString(list, separator);
            } else if (v.ctor === "::") {
                var output = '[\n' + toString(v._0, separator);
                v = v._1;
                while (v && v.ctor === "::") {
                    output += ",\n" + toString(v._0, separator);
                    v = v._1;
                }
                return output.replace(/\n/g,"\n" + separator) + "\n]";
            } else if (v.ctor === "[]") {
                return "[]";
            } else if (v.ctor === "RBNode" || v.ctor === "RBEmpty") {
                if (!Dict || !List) {
                    Dict = Elm.Dict.make(independentRuntime);
                    List = Elm.List.make(independentRuntime);
                }
                var list = Dict.toList(v);
                var name = "Dict";
                if (list.ctor === "::" && list._0._1.ctor === "_Tuple0") {
                    name = "Set";
                    list = A2(List.map, function(x){return x._0}, list);
                }
                return name + ".fromList " + toString(list, separator);
            } else {
                var output = "";
                for (var i in v) {
                    if (i === 'ctor') continue;
                    var str = toString(v[i], separator);
                    var parenless = str[0] === '{' ||
                                    str[0] === '<' ||
                                    str[0] === "[" ||
                                    str.indexOf(' ') < 0;
                    output += ' ' + (parenless ? str : "(" + str + ')');
                }
                return v.ctor + output;
            }
        }
        if (type === 'object' && 'recv' in v) return '<signal>';
        return "<internal structure>";
    };

    function addSlashes(str) {
        return str.replace(/\\/g, '\\\\')
                  .replace(/\n/g, '\\n')
                  .replace(/\t/g, '\\t')
                  .replace(/\r/g, '\\r')
                  .replace(/\v/g, '\\v')
                  .replace(/\0/g, '\\0')
                  .replace(/\'/g, "\\'")
                  .replace(/\"/g, '\\"');
    }

    function probablyPublic(v) {
        var keys = Object.keys(v);
        var len = keys.length;
        if (len === 3
            && 'props' in v
            && 'element' in v) return false;
        if (len === 5
            && 'horizontal' in v
            && 'vertical' in v
            && 'x' in v
            && 'y' in v) return false;
        if (len === 7
            && 'theta' in v
            && 'scale' in v
            && 'x' in v
            && 'y' in v
            && 'alpha' in v
            && 'form' in v) return false;
        return true;
    }

    return toString;
}();


}());