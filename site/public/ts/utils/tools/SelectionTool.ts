import {LEFT_MOUSE_BUTTON,
        SHIFT_KEY, DELETE_KEY,
        BACKSPACE_KEY, ESC_KEY,
        A_KEY, IO_PORT_RADIUS} from "../Constants";
import {Vector,V} from "../math/Vector";
import {Transform} from "../math/Transform";
import {TransformContains,
        CircleContains,
        BezierContains} from "../math/MathUtils";
import {SeparatedComponentCollection,
        GatherGroup} from "../ComponentUtils";

import {Tool} from "./Tool";

import {CircuitDesigner} from "../../models/CircuitDesigner";
import {IOObject} from "../../models/ioobjects/IOObject";
import {Component} from "../../models/ioobjects/Component";

import {PressableComponent} from "../../models/ioobjects/PressableComponent";
import {PlaceComponentTool} from "./PlaceComponentTool"

import {Input} from "../Input";
import {Camera} from "../Camera";

import {Action} from "../actions/Action";
import {GroupAction} from "../actions/GroupAction";
import {SelectAction} from "../actions/SelectAction";
import {DeleteAction} from "../actions/DeleteAction";
import {DeleteWireAction} from "../actions/DeleteWireAction";

export class SelectionTool extends Tool {

    private designer: CircuitDesigner;
    private camera: Camera;

    private selections: Array<IOObject>;
    private selecting: boolean;

    // These functions are called every time the selections change
    // TODO: pass selections as argument
    private callbacks: Array<{ (): void }>;

    // Current selection box positions
    private p1: Vector;
    private p2: Vector;

    private currentPressedObj: IOObject;
    private pressedObj: boolean;

    private disabledSelections: boolean;

    private lastAction: Action;

    public constructor(designer: CircuitDesigner, camera: Camera) {
        super();

        this.designer = designer;
        this.camera = camera;

        this.selections = [];
        this.selecting = false;

        this.disabledSelections = false;

        this.lastAction = undefined;

        this.callbacks = [];
    }

    private selectionsChanged(): void {
        this.callbacks.forEach(c => c());
    }

    private setAction(action: Action) {
        // Don't set action if it's an empty group action
        if (action instanceof GroupAction && action.isEmpty())
            return;

        this.lastAction = action;
    }

    public addSelection(obj: IOObject): boolean {
        // Don't select anything if it's disabled
        if (this.disabledSelections)
            return false;

        if (!this.selections.includes(obj)) {
            this.selections.push(obj);
            this.selectionsChanged();
            return true;
        }
        return false;
    }

    public addSelections(objs: Array<IOObject>): boolean {
        // Don't select anything if it's disabled
        if (this.disabledSelections)
            return false;

        // If something was already added then don't add it
        objs = objs.filter(o => !this.selections.includes(o));

        // Add the objects
        this.selections = this.selections.concat(objs);

        this.selectionsChanged();

        return true;
    }

    public removeSelection(obj: IOObject): boolean {
        // Don't deselect anything if it's disabled
        if (this.disabledSelections)
            return false;

        const i = this.selections.indexOf(obj);
        if (i != -1) {
            this.selections.splice(i, 1);
            this.selectionsChanged();
            return true;
        }
        return false;
    }

    public selectAll(): void {
        const objects = this.designer.getObjects();

        const group = new GroupAction();
        for (const obj of objects)
            group.add(new SelectAction(this, obj));
        this.addSelections(objects);
        this.setAction(group);
    }

    public clearSelections(): Action {
        const group = new GroupAction();
        if (this.selections.length == 0)
            return group;
        // Create actions
        this.selections.forEach((obj) => group.add(new SelectAction(this, obj, true)));
        this.selections = [];
        this.selectionsChanged();
        return group;
    }

    public setCurrentlyPressedObj(obj: IOObject): void {
        this.currentPressedObj = obj;
    }

    public disableSelections(val: boolean = true) {
        this.disabledSelections = val;
    }

    public activate(currentTool: Tool, event: string, input: Input, button?: number): boolean {
        if (event == "mouseup")
            this.onMouseUp(input, button);
        if (event == "onclick" && !(currentTool instanceof PlaceComponentTool))
            this.onClick(input, button);
        return false;
    }

    public deactivate(event: string, input: Input, button?: number): boolean {
        this.selecting = false;

        return false;
    }

    public onMouseDown(input: Input, button: number): boolean {
        if (button === LEFT_MOUSE_BUTTON) {
            let worldMousePos = this.camera.getWorldPos(input.getMousePos());

            let objects = this.designer.getObjects();
            for (let i = objects.length-1; i >= 0; i--) {
                let obj = objects[i];

                // Check if we pressed the object
                if (obj.isWithinPressBounds(worldMousePos)) {
                    if (obj instanceof PressableComponent)
                        obj.press();
                    this.pressedObj = true;
                    this.currentPressedObj = obj;
                    return true;
                }
                // If just the selection box was hit then
                //  don't call the press() method, just set
                //  currentPressedObj to potentially drag
                else if (obj.isWithinSelectBounds(worldMousePos)) {
                    this.pressedObj = false;
                    this.currentPressedObj = obj;
                    return false;
                }
            }

            // Go through every wire and check to see if it has been pressed
            for (let w of this.designer.getWires()) {
                if (BezierContains(w.getShape(), worldMousePos)) {
                    this.pressedObj = false;
                    this.currentPressedObj = w;
                    return false;
                }
            }
        }
    }

    public onMouseDrag(input: Input, button: number): boolean {
        // Update positions of selection
        //  box and set selecting to true
        if (button === LEFT_MOUSE_BUTTON && !this.disabledSelections) {
            this.selecting = true;

            // Update selection box positions
            this.p1 = input.getMouseDownPos();
            this.p2 = input.getMousePos();

            return true; // should render
        }

        return false;
    }

    public onMouseUp(input: Input, button: number): boolean {
        // Find selections within the
        //  current selection box
        if (button === LEFT_MOUSE_BUTTON) {
            // Release currently pressed object
            if (this.pressedObj) {
                this.pressedObj = false;
                if (this.currentPressedObj instanceof PressableComponent)
                    this.currentPressedObj.release();
                this.currentPressedObj = undefined;
                return true;
            }
            this.currentPressedObj = undefined;

            // Stop selection box
            if (this.selecting) {
                this.selecting = false;

                // Create action
                const group = new GroupAction();

                // Clear selections if no shift key
                if (!input.isKeyDown(SHIFT_KEY))
                    group.add(this.clearSelections());


                // Calculate transform rectangle of the selection box
                let p1 = this.camera.getWorldPos(input.getMouseDownPos());
                let p2 = this.camera.getWorldPos(input.getMousePos());
                let box = new Transform(p1.add(p2).scale(0.5), p2.sub(p1).abs());

                // Go through each object and see if it's within
                //  the selection box
                let objects = this.designer.getObjects();
                let selections = [];
                for (let obj of objects) {
                    // Check if object is in box
                    if (TransformContains(box, obj.getTransform())) {
                        selections.push(obj);
                        group.add(new SelectAction(this, obj)); // Add action
                    }
                }
                this.addSelections(selections);

                // Set as action if we changed selections added something
                this.setAction(group);

                return true; // should render
            }
        }

        return false;
    }

    public onClick(input: Input, button: number): boolean {
        if (button === LEFT_MOUSE_BUTTON) {
            let worldMousePos = this.camera.getWorldPos(input.getMousePos());

            let render = false;

            const group = new GroupAction();

            // Clear selections if no shift key
            if (!input.isShiftKeyDown()) {
                group.add(this.clearSelections());
                render = !group.isEmpty(); // Render if selections were actually cleared
            }

            // Check if an object was clicked
            //  and add to selections
            let objects = this.designer.getObjects();
            for (let i = objects.length-1; i >= 0; i--) {
                let obj = objects[i];

                if (obj.isWithinPressBounds(worldMousePos)) {
                    // Check if object should be clicked
                    if (obj instanceof PressableComponent) {
                        obj.click();
                        render = true;
                        break;
                    }
                }
                // Check if object should be selected
                else if (obj.isWithinSelectBounds(worldMousePos)) {
                    // Deselect it if it's already selected and we're holding shift
                    let deselect = false;
                    if (input.isShiftKeyDown())
                        deselect = this.removeSelection(obj);

                    // Add select action
                    group.add(new SelectAction(this, obj, deselect));
                    render = deselect || this.addSelection(obj) || render;
                    break;
                }
                // Check if a port was clicked
                else {
                    if (obj.getPorts().some((p) => CircleContains(p.getWorldTargetPos(), IO_PORT_RADIUS, worldMousePos)))
                        return false;
                }
            }

            // Go through every wire and check to see if it has been clicked
            //  and add to selections
            for (let w of this.designer.getWires()) {
                if (BezierContains(w.getShape(), worldMousePos))
                    return this.addSelection(w);
            }

            this.setAction(group);

            return render;
        }

        return false;
    }

    public onKeyDown(input: Input, key: number): boolean {
        // If modifier key and a key are pressed, select all
        if (input.isModifierKeyDown() && key == A_KEY) {
            this.selectAll();
            return true;
        }

        if (this.selections.length == 0)
            return false;

        if (key == DELETE_KEY || key == BACKSPACE_KEY) {
            const allDeletions: SeparatedComponentCollection = GatherGroup(this.selections);
            const components = allDeletions.getAllComponents();
            const wires = allDeletions.wires;

            // Create actions for deletion of wires then objects
            //  order matters because the components need to be added
            //  (when undoing) before the wires can be connected
            const group = new GroupAction();
            for (const obj of this.selections)
                group.add(new SelectAction(this, obj, true));
            for (const wire of wires)
                group.add(new DeleteWireAction(wire));
            for (const obj of components)
                group.add(new DeleteAction(obj));

            this.setAction(group);

            // Actually delete the objects/wires
            for (const wire of wires)
                this.designer.removeWire(wire);
            for (const obj of components)
                this.designer.removeObject(obj);

            this.clearSelections();
            return true;
        }
        if (key == ESC_KEY) {
            this.setAction(this.clearSelections());
            return true;
        }

        return false;
    }

    public calculateMidpoint(): Vector {
        let selections = this.selections;
        let midpoint = V();
        for (let obj of selections) {
            if (obj instanceof Component)
                midpoint.translate(obj.getPos());
        }
        return midpoint.scale(1. / selections.length);
    }

    public getAction(): Action {
        const action = this.lastAction;

        // Remove action
        this.lastAction = undefined;

        return action;
    }

    public getSelections(): Array<IOObject> {
        return this.selections.slice(); // shallow copy
    }
    public isSelecting(): boolean {
        return this.selecting;
    }

    public getP1(): Vector {
        return this.p1.copy();
    }
    public getP2(): Vector {
        return this.p2.copy();
    }

    public addSelectionChangeListener(func: {(): void}) {
        this.callbacks.push(func);
    }
    public getCurrentlyPressedObj(): IOObject {
        return this.currentPressedObj;
    }

}
