import {useState} from "react";

import {CircuitInfo} from "core/utils/CircuitInfo";

import {Action} from "core/actions/Action";
import {GroupAction} from "core/actions/GroupAction";

import {useSharedDispatch, useSharedSelector} from "shared/utils/hooks/useShared";
import {useHistory} from "shared/utils/hooks/useHistory";

import {CloseHistoryBox} from "shared/state/ItemNav";

import "./index.scss";


type HistoryEntryProps = {
    a: Action;
    isRedo: boolean;
}
const HistoryEntry = ({ a, isRedo }: HistoryEntryProps) => {
    if (a instanceof GroupAction)
        return (<GroupActionEntry g={a} isRedo={isRedo}></GroupActionEntry>);
    return (
        <div className={isRedo ? "historybox__dashedentry" : "historybox__entry"}
            // Necessary to stop child entries from collapsing the parent history entry
            onClick={(e) => e.stopPropagation()}>
            {a.getName()}
        </div>
    );
}

type GroupActionEntryProps = {
    g: GroupAction;
    isRedo: boolean;
}
const GroupActionEntry = ({ g, isRedo }: GroupActionEntryProps) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    if (g.isEmpty())
        return null;
    if (g.getActions().length === 1)
        return (<HistoryEntry a={g.getActions()[0]} isRedo={isRedo}></HistoryEntry>);
    return (
        <div className={isRedo ? "historybox__dashedgroupentry" : "historybox__groupentry"}
            onClick={(e) => {
                // Necessary to stop child entries from collapsing the parent history entry
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
            }}>
            <span>{g.getName()}</span>
            <span
                className={`historybox__groupentry__collapse_btn \
                            ${isCollapsed ? "historybox__groupentry__collapse_btn-collapsed" : "" }`}>
                &rsaquo;
            </span>
            {!isCollapsed && g.getActions().map((a, i) => {
                return(<HistoryEntry key={isRedo ? `group-action-dashedentry-${i}` : `group-action-entry-${i}`} a={a} isRedo={true} ></HistoryEntry>);
            })}
        </div>
    );
}


type Props = {
    info: CircuitInfo;
}
export const HistoryBox = ({ info }: Props) => {
    const { isOpen, isHistoryBoxOpen } = useSharedSelector(
        state => ({ ...state.itemNav })
    );
    const dispatch = useSharedDispatch();

    const { undoHistory, redoHistory } = useHistory(info);

    return (
        <div className={`historybox ${isOpen ? "" : "historybox__move"} ${isHistoryBoxOpen ? "" : "hide"}`}>
            <div>
                <span>History</span>
                <span onClick={() => dispatch(CloseHistoryBox())}>×</span>
            </div>
            <div>
                { redoHistory.length > 0 && (<>
                    {[...redoHistory].reverse().map((a, i) =>
                        <HistoryEntry key={`history-box-dashedentry-${i}`} a={a} isRedo></HistoryEntry>
                    )}
                    <div style={{textAlign: 'center', fontWeight: 'bold'}}> Redo </div>
                    <div className={"historybox__separator"} > </div>
                 </>)}
                <div style={{textAlign: 'center', fontWeight: 'bold'}}> Undo </div>
                {[...undoHistory].reverse().map((a, i) =>
                    <HistoryEntry key={`history-box-entry-${i}`} a={a} isRedo={false}></HistoryEntry>
                )}
                
            </div>
        </div>
    );
}