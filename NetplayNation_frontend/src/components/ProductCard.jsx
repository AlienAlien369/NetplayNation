import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import { Link , Route} from 'react-router-dom'
import SingleProduct from '../pages/SingleProduct';

function ProductCard({tempid , productImage, productName  , productDesc , productPrice }) {
  return (
    <Card style={{ width: '18rem' }}>
      <Card.Body>
        <img src={productImage} alt={productName}  style={{ width: '250px' , height:'200px'}}/>
        <Card.Title>{productName}</Card.Title>
        <Card.Title>Rs.{productPrice}</Card.Title>
        <Card.Text>
          {productDesc}
        </Card.Text>
        <Link to={`/products/${tempid}`}><Button variant="primary">More</Button></Link>
      </Card.Body>
    </Card>
  );
}

export default ProductCard;