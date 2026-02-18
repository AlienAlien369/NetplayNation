import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import BrandImage from '../assests/logo/logo-no-background.png'

function BasicExample() {
    return (
        <Navbar expand="lg" className="bg-body-tertiary">
            <Container>
                <Navbar.Brand href="/">
                    <img src={BrandImage} style={{height: '60px' , width: '180px'}} alt="" />
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto ">
                        <Nav.Link className='px-5' href="/">Home</Nav.Link>
                        <Nav.Link className='px-5' href="/products">Products</Nav.Link>
                        <Nav.Link className='px-5' href="/about">About</Nav.Link>
                        {/* <Nav.Link href="/about">Contact Us</Nav.Link> */}
                        {/* <Nav.Link href="/adminpanel/uploadproduct">product upload</Nav.Link> */}
                        {/* <NavDropdown title="Dropdown" id="basic-nav-dropdown">
                            <NavDropdown.Item href="#action/3.1">Action</NavDropdown.Item>
                            <NavDropdown.Item href="#action/3.2">
                                Another action
                            </NavDropdown.Item>
                            <NavDropdown.Item href="#action/3.3">Something</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item href="#action/3.4">
                                Separated link
                            </NavDropdown.Item>
                        </NavDropdown> */}
                        {/* <Link to="/signup">
                            <Button variant="outline-primary">SignUp</Button>{' '}
                        </Link>
                        <Link to="/login">
                            <Button variant="outline-primary">Login</Button>{' '}
                        </Link> */}

                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default BasicExample;