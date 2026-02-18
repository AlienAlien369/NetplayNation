import React, { useState } from 'react';
import { Container, Row, Col, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.css';
import ProductForm from './AdminPages/AdminProductForm';
import NewAdminPage from './AdminPages/NewAdminPage';
// import AdminSidebar from '../components/AdminSidebar'

const AdminPage = () => {

    const [selectedItem, setSelectedItem] = useState('products');

    const handleItemClick = (itemName) => {
        setSelectedItem(itemName);
    }

    // Define your content components
    const getContentComponent = () => {
        switch (selectedItem) {
            case 'products':
                return <ProductForm />;
            case 'newadmin':
                return <NewAdminPage />;
            default:
                return <ProductForm />;
        }
    }

    return (
        <>
            <Container fluid className='vh-100 p-0'>
                <Row className=''>
                    <Col xs={2} className='border min-vh-100'>
                        <Nav defaultActiveKey="" className="flex-column">
                            <Nav.Item>
                                <Link to="#" className={`nav-link ${selectedItem === 'products' ? 'active' : ''}`} onClick={() => handleItemClick('products')}>Products</Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Link to="#" className={`nav-link ${selectedItem === 'newadmin' ? 'active' : ''}`} onClick={() => handleItemClick('newadmin')}>New Admin</Link>
                            </Nav.Item>
                        </Nav>
                    </Col>
                    <Col className='border min-vh-100'>
                        {getContentComponent()}
                    </Col>
                </Row>
            </Container>
        </>
    );
}

export default AdminPage;
