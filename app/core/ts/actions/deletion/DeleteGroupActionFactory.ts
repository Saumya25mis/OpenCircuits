import {GroupAction} from "core/actions/GroupAction";
import {DeselectAction} from "core/actions/selection/SelectAction";
import {DeleteAction} from "core/actions/addition/PlaceAction";
import {DisconnectAction} from "core/actions/addition/ConnectionAction";

import {SelectionTool} from "core/tools/SelectionTool";

import {GatherGroup} from "core/utils/ComponentUtils";

import {IOObject} from "core/models/IOObject";

export function CreateDeleteGroupAction(selectionTool: SelectionTool, objects: Array<IOObject>): GroupAction {
    const action = new GroupAction();

    const allDeletions = GatherGroup(objects);
    const components = allDeletions.getAllComponents();
    const wires = allDeletions.wires;

    // Create actions for deletion of wires then objects
    //  order matters because the components need to be added
    //  (when undoing) before the wires can be connected
    action.add(objects.map((obj)    => new DeselectAction(selectionTool, obj)));
    action.add(wires.map((wire)     => new DisconnectAction(wire)));
    action.add(components.map((obj) => new DeleteAction(obj)));

    return action;
}
