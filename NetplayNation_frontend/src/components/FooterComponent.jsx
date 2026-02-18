import React from 'react';
import "../scss/footerComponent.scss";
// import contact__img from '../../assets/videoAnimations/contact.gif';
import footerImage from '../assests/vectors/smash.jpg';
import BrandImage from '../assests/logo/logo-no-background.png';

import { Container , Row , Col , ListGroup , ListGroupItem } from 'reactstrap';
import { Link } from 'react-router-dom';


const quick__links=[
  {
    path:'#home',
    display:'Home'
  },
  {
    path:'/products',
    display:'Products'
  },
  {
    path:'/about',
    display:'About us'  
  },
  
];



const FooterComponent = () => {
  
  const todayYear = new Date().getFullYear();

  return (
    <footer id="footer">
      <Container>
        <Row>
          <Col lg='3'>
            <div className="logo d-flex flex-column justify-content-center  align-items-center">
              <p className='text-center'>Let's connect with each other & try to take Badminton to next level.</p>

              <div className="social__links d-flex align-items-cemter gap-4">
                <span>
                  <a target="blank" href='https://wa.link/y3lbdr'><i class="ri-whatsapp-fill"></i></a>
                </span>
                <span>
                  <a target="blank" href='https://www.linkedin.com/in/lakshya-grover/'><i className="ri-linkedin-box-fill"></i></a>
                </span>
                <span>
                  <a target="blank" href='https://github.com/LakshyaGrover369'><i className="ri-github-fill"></i></a>
                </span>
              </div>
              <div className='mt-3'><img src={BrandImage} style={{height: '80px' , width: '200px'}}  alt="" /></div>
            </div>
          </Col>
          <Col className="footer__sub_links" lg='3'>
            <h5 className="footer__link-title">Discover</h5>
            <ListGroup className='footer__quick-links'>
              {quick__links.map((item, index) =>(
                <ListGroupItem key={index} className='ps-0 border-0'>
                  <Link to={item.path}>{item.display}</Link>
                </ListGroupItem>
              ))}
            </ListGroup>
            
          </Col>
          <Col lg='3'>
          <img className='contact__img' src={footerImage} alt="gif" />
         
          </Col>

          <Col lg='3'>
          <h5 className="footer__link-title">Contact</h5>
          <ListGroup className='footer__quick-links'>
                <ListGroupItem className='ps-0 border-0 d-flex align-items-center gap-3'>
                  <h6 className='mb-0 d-flex align-items-center gap-2'>
                    <span>
                      <i className="ri-map-pin-line"></i>
                      Address:
                    </span>
                  </h6>
                  <p className="mb-0"> Delhi, India</p>
                </ListGroupItem>
                <ListGroupItem className='ps-0 border-0 d-flex align-items-center gap-3'>
                  <h6 className='mb-0 d-flex align-items-center gap-2'>
                    <span>
                      <i className="ri-mail-line"></i>
                      Email:
                    </span>
                  </h6>
                  <p className="mb-0">groverlakshya.25.lg@gmail.com</p>
                </ListGroupItem>
                <ListGroupItem className='ps-0 border-0 d-flex align-items-center gap-3'>
                  <h6 className='mb-0 d-flex align-items-center gap-2'>
                    <span>
                      <i className="ri-phone-fill"></i>
                      Phone:
                    </span>
                  </h6>
                  <p className="mb-0">+91 8800191819</p>
                </ListGroupItem>
            
            </ListGroup>
          </Col>
          <Col lg='12' className='text-center pt-5'>
            <p className="copyright"> Copyright {todayYear}, design and develop by Lakshya Grover. All rights reserved.</p>
          </Col>
        </Row>
      </Container>
    </footer>
  )
}

export default FooterComponent