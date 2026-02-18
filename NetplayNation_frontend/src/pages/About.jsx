import React from 'react';
import FooterComponent from '../components/FooterComponent';
import aboutImage from '../assests/vectors/lcw_victory.jpg';

const About = () => {
  return (
    <>
    <section className='m-auto w-75 d-flex justify-content-center align-items-center '>

        <img src={aboutImage} style={{height: '500px'}} alt="" />
        <div>
        <div style={{fontFamily: 'Sans-serif',  padding: '18px', color: 'black' , textAlign:'center'}}><br /><h2 style={{fontFamily: 'Sans-serif', color: 'black'}}>About Us !</h2>
          <h2 style={{fontFamily: 'Sans-serif', textAlign: 'center'}}>Welcome To <span id="W_Name1">Netplay nation</span></h2>
          <p><span id="W_Name2">Netplay nation</span> is a Professional <span id="W_Type1">product</span> Platform. Here we will only provide you with interesting content that you will enjoy very much. We are committed to providing you the best of <span id="W_Type2">product</span>, with a focus on reliability and <span id="W_Spec">product description</span>. we strive to turn our passion for <span id="W_Type3">product</span> into a thriving website. We hope you enjoy our <span id="W_Type4">product</span> as much as we enjoy giving them to you.</p>
          <p>I will keep on posting such valuable anf knowledgeable information on my Website for all of you. Your love and support matters a lot.</p>
          <p style={{fontWeight: 'bold', textAlign: 'center'}}>Thank you For Visiting Our Site<br /><br />
            <span style={{color: 'blue', fontSize: '16px', fontWeight: 'bold', textAlign: 'center'}}>Have a great day !</span></p></div><br /><br />
        </div>
    </section>
        <FooterComponent/>
    </>
  )
}

export default About