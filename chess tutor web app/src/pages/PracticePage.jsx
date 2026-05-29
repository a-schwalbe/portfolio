import ChessBoard from "../components/ChessBoard";
import LessonCard from "../components/LessonCard";
import Tips from "../components/tips";
import Header from "../components/Header";

export default function PracticePage(){
    return(
        <div>
            <Header title="Practice Board" badge="Gameplay" subtitle="This board is for practicing playing games. You can test new opening lines, and play full games!"/>
            
            <LessonCard title="Functionality">
                <p>
                    This board is an interactive chessboard where games can be played. Pieces can be moved by dragging them, or clicking on them to see all legal moves they can go to. Undo and redo allow for going back and trying new moves. Reset restarts the game to the beginning.
                </p>
            </LessonCard>

            <Tips>
                Try practicing moves from either the Sicilian or London without looking up the moves!
            </Tips>
            <ChessBoard title="Chessboard for Practice!" description="Practice any chess opening lines you want!"/>
            
        </div>
    )
}