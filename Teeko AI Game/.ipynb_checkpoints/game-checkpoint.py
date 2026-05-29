import random
import copy
import heapq

class TeekoPlayer:
    """ An object representation for an AI game player for the game Teeko.
    """
    board = [[' ' for j in range(5)] for i in range(5)]
    pieces = ['b', 'r']

    def __init__(self):
        """ Initializes a TeekoPlayer object by randomly selecting red or black as its
        piece color.
        """
        self.my_piece = random.choice(self.pieces)
        self.opp = self.pieces[0] if self.my_piece == self.pieces[1] else self.pieces[1]

    def run_challenge_test(self):
        """ Set to True if you would like to run gradescope against the challenge AI!
        Leave as False if you would like to run the gradescope tests faster for debugging.
        You can still get full credit with this set to False
        """ 
        return False

    def make_move(self, state):
        """ Selects a (row, col) space for the next move. You may assume that whenever
        this function is called, it is this player's turn to move.

        Args:
            state (list of lists): should be the current state of the game as saved in
                this TeekoPlayer object. Note that this is NOT assumed to be a copy of
                the game state and should NOT be modified within this method (use
                place_piece() instead). Any modifications (e.g. to generate successors)
                should be done on a deep copy of the state.

                In the "drop phase", the state will contain less than 8 elements which
                are not ' ' (a single space character).

        Return:
            move (list): a list of move tuples such that its format is
                    [(row, col), (source_row, source_col)]
                where the (row, col) tuple is the location to place a piece and the
                optional (source_row, source_col) tuple contains the location of the
                piece the AI plans to relocate (for moves after the drop phase). In
                the drop phase, this list should contain ONLY THE FIRST tuple.

        Note that without drop phase behavior, the AI will just keep placing new markers
            and will eventually take over the board. This is not a valid strategy and
            will earn you no points.
        """
        
        drop_phase = sum(i.count('b') + i.count('r') for i in state) < 8   # TODO: detect drop phase
        if drop_phase:
            all_succ = self.succ(state, self.my_piece, drop_phase)
            for state_updated, move in all_succ:
                if self.game_value(state_updated) == 1:
                    return move
            opponent_attempt = self.succ(state, self.opp, drop_phase)
            for state_updated, move in opponent_attempt:
                if self.game_value(state_updated) == -1:
                    winning_pos = move[0]
                    for state_up, state_move in self.succ(state, self.my_piece, drop_phase):
                        if state_move[0] == winning_pos:    
                            return state_move

            final = float('-inf')
            final_move = None
            for state_updated, move in all_succ:
                curr_s = self.heuristic_game_value(state_updated, drop_phase)
                if curr_s > final:
                    final = curr_s
                    final_move = move
            return final_move
            
        else:
            all_succ = self.succ(state, self.my_piece, drop_phase)
            for state_updated, move in all_succ:
                if self.game_value(state_updated) == 1:
                    return move
            opponent_attempt = self.succ(state, self.opp, drop_phase)
            for state_updated, move in opponent_attempt:
                if self.game_value(state_updated) == -1:
                    winning_pos = move[0]
                    for state_up, state_move in self.succ(state, self.my_piece, drop_phase):
                        if state_move[0] == winning_pos:    
                            return state_move
            final = float('-inf')
            final_move = None
            for state_updated, move in all_succ:
                curr_s = self.heuristic_game_value(state_updated, drop_phase)
                if curr_s > final:
                    final = curr_s
                    final_move = move
            return final_move


    def succ(self, state, player, drop_phase):
        all_succ = []
        if drop_phase:
            for i in range(5):
                for j in range(5):
                    if state[i][j] == ' ':
                        state_updated = copy.deepcopy(state)
                        state_updated[i][j] = player
                        all_succ.append((state_updated, [(i, j)]))
        else:
            for i in range(5):
                for j in range(5):
                    if state[i][j] != player:
                        continue
                    if state[i][j] == player:
                        for row_changes in [-1, 0, 1]:
                            for column_changes in [-1, 0, 1]:
                                if row_changes == 0 and column_changes == 0:
                                    continue
                                changed_row, changed_col = i + row_changes, j +column_changes
                                if 0 <= changed_row <= 4 and 0 <= changed_col <= 4:
                                    if state[changed_row][changed_col] == ' ':
                                        state_updated = copy.deepcopy(state)
                                        state_updated[changed_row][changed_col] = player
                                        state_updated[i][j] = ' '
                                        all_succ.append((state_updated, [(changed_row, changed_col), (i, j)]))
        return all_succ


    def max_value(self, state, depth):
        drop_phase = sum(i.count('b') + i.count('r') for i in state) < 8
        if self.game_value(state) != 0 or depth == 3:
            return self.heuristic_game_value(state, drop_phase)

        alpha = float('-inf')
        for s_prime, move in self.succ(state, self.my_piece, drop_phase):
            alpha = max(alpha, self.min_value(s_prime, depth+1))
        return alpha
            

    def min_value(self, state, depth):
        drop_phase = sum(i.count('b') + i.count('r') for i in state) < 8
        if self.game_value(state) != 0 or depth == 3:
            return self.heuristic_game_value(state, drop_phase)

        beta = float('inf')
        for s_prime, move in self.succ(state, self.opp, drop_phase):
            beta = min(beta, self.max_value(s_prime, depth+1))
        return beta

    
    def heuristic_game_value(self, state, drop_phase):
        ai = len(self.succ(state, self.my_piece, drop_phase))
        opponent = len(self.succ(state, self.opp, drop_phase))
        return max(-1.0, min(1.0, (ai - opponent)/16))

    def opponent_move(self, move):
        """ Validates the opponent's next move against the internal board representation.
        You don't need to touch this code.

        Args:
            move (list): a list of move tuples such that its format is
                    [(row, col), (source_row, source_col)]
                where the (row, col) tuple is the location to place a piece and the
                optional (source_row, source_col) tuple contains the location of the
                piece the AI plans to relocate (for moves after the drop phase). In
                the drop phase, this list should contain ONLY THE FIRST tuple.
        """
        # validate input
        if len(move) > 1:
            source_row = move[1][0]
            source_col = move[1][1]
            if source_row != None and self.board[source_row][source_col] != self.opp:
                self.print_board()
                print(move)
                raise Exception("You don't have a piece there!")
            if abs(source_row - move[0][0]) > 1 or abs(source_col - move[0][1]) > 1:
                self.print_board()
                print(move)
                raise Exception('Illegal move: Can only move to an adjacent space')
        if self.board[move[0][0]][move[0][1]] != ' ':
            raise Exception("Illegal move detected")
        # make move
        self.place_piece(move, self.opp)

    def place_piece(self, move, piece):
        """ Modifies the board representation using the specified move and piece

        Args:
            move (list): a list of move tuples such that its format is
                    [(row, col), (source_row, source_col)]
                where the (row, col) tuple is the location to place a piece and the
                optional (source_row, source_col) tuple contains the location of the
                piece the AI plans to relocate (for moves after the drop phase). In
                the drop phase, this list should contain ONLY THE FIRST tuple.

                This argument is assumed to have been validated before this method
                is called.
            piece (str): the piece ('b' or 'r') to place on the board
        """
        if len(move) > 1:
            self.board[move[1][0]][move[1][1]] = ' '
        self.board[move[0][0]][move[0][1]] = piece

    def print_board(self):
        """ Formatted printing for the board """
        for row in range(len(self.board)):
            line = str(row)+": "
            for cell in self.board[row]:
                line += cell + " "
            print(line)
        print("   A B C D E")

    def game_value(self, state):
        """ Checks the current board status for a win condition

        Args:
        state (list of lists): either the current state of the game as saved in
            this TeekoPlayer object, or a generated successor state.

        Returns:
            int: 1 if this TeekoPlayer wins, -1 if the opponent wins, 0 if no winner

        TODO: complete checks for diagonal and box wins
        """
        # check horizontal wins
        for row in state:
            for i in range(2):
                if row[i] != ' ' and row[i] == row[i+1] == row[i+2] == row[i+3]:
                    return 1 if row[i]==self.my_piece else -1

        # check vertical wins
        for col in range(5):
            for i in range(2):
                if state[i][col] != ' ' and state[i][col] == state[i+1][col] == state[i+2][col] == state[i+3][col]:
                    return 1 if state[i][col]==self.my_piece else -1

        # TODO: check / diagonal wins
        for i in range(2):
            for j in range(3, 5):
                if state[i][j] != ' ' and state[i][j] == state[i+1][j-1] == state[i+2][j-2] == state[i+3][j-3]:
                    return 1 if state[i][j]==self.my_piece else -1
                
            
        # TODO: check \ diagonal wins
        for i in range(2):
            for j in range(2):
                if state[i][j] != ' ' and state[i][j] == state[i+1][j+1] == state[i+2][j+2] == state[i+3][j+3]:
                    return 1 if state[i][j]==self.my_piece else -1
        # TODO: check box wins
        for i in range(4):
            for j in range(4):
                if state[i][j] != ' ' and state[i][j] == state[i][j+1] == state[i+1][j] == state[i+1][j+1]:
                    return 1 if state[i][j]==self.my_piece else -1

        return 0 # no winner yet

############################################################################
#
# THE FOLLOWING CODE IS FOR SAMPLE GAMEPLAY ONLY
#
############################################################################
def main():
    print('Hello, this is Samaritan')
    ai = TeekoPlayer()
    piece_count = 0
    turn = 0

    # drop phase
    while piece_count < 8 and ai.game_value(ai.board) == 0:

        # get the player or AI's move
        if ai.my_piece == ai.pieces[turn]:
            ai.print_board()
            move = ai.make_move(ai.board)
            ai.place_piece(move, ai.my_piece)
            print(ai.my_piece+" moved at "+chr(move[0][1]+ord("A"))+str(move[0][0]))
        else:
            move_made = False
            ai.print_board()
            print(ai.opp+"'s turn")
            while not move_made:
                player_move = input("Move (e.g. B3): ")
                while player_move[0] not in "ABCDE" or player_move[1] not in "01234":
                    player_move = input("Move (e.g. B3): ")
                try:
                    ai.opponent_move([(int(player_move[1]), ord(player_move[0])-ord("A"))])
                    move_made = True
                except Exception as e:
                    print(e)

        # update the game variables
        piece_count += 1
        turn += 1
        turn %= 2

    # move phase - can't have a winner until all 8 pieces are on the board
    while ai.game_value(ai.board) == 0:

        # get the player or AI's move
        if ai.my_piece == ai.pieces[turn]:
            ai.print_board()
            move = ai.make_move(ai.board)
            ai.place_piece(move, ai.my_piece)
            print(ai.my_piece+" moved from "+chr(move[1][1]+ord("A"))+str(move[1][0]))
            print("  to "+chr(move[0][1]+ord("A"))+str(move[0][0]))
        else:
            move_made = False
            ai.print_board()
            print(ai.opp+"'s turn")
            while not move_made:
                move_from = input("Move from (e.g. B3): ")
                while move_from[0] not in "ABCDE" or move_from[1] not in "01234":
                    move_from = input("Move from (e.g. B3): ")
                move_to = input("Move to (e.g. B3): ")
                while move_to[0] not in "ABCDE" or move_to[1] not in "01234":
                    move_to = input("Move to (e.g. B3): ")
                try:
                    ai.opponent_move([(int(move_to[1]), ord(move_to[0])-ord("A")),
                                    (int(move_from[1]), ord(move_from[0])-ord("A"))])
                    move_made = True
                except Exception as e:
                    print(e)

        # update the game variables
        turn += 1
        turn %= 2

    ai.print_board()
    if ai.game_value(ai.board) == 1:
        print("AI wins! Game over.")
    else:
        print("You win! Game over.")


if __name__ == "__main__":
    main()
