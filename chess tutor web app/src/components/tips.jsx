import { Alert } from 'react-bootstrap'

export default function Tips({children}){
    return(
        <Alert variant="info" className="rounded-4">
            <strong>Tip:</strong> {children}
        </Alert>
    )
}