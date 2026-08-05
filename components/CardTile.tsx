// 서버 컴포넌트. 카드 한 장을 렌더한다.
// 이미지는 image_base(원본) + '/low.webp' 로 TCGdex CDN 핫링크. (§2-4)
import AddToBinder from "./AddToBinder";

interface CardTileProps {
  card: {
    id: number;
    name: string;
    local_id: string;
    rarity: string | null;
    category: string;
    image_base: string | null;
  };
}

export default function CardTile({ card }: CardTileProps) {
  return (
    <div className="card-tile">
      <div className="imgwrap">
        {card.image_base ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${card.image_base}/low.webp`} alt={card.name} loading="lazy" />
        ) : (
          <span className="noimg">이미지 없음</span>
        )}
      </div>
      <div className="body">
        <div className="cname">{card.name}</div>
        <div className="cmeta">
          {card.local_id}
          {card.rarity ? ` · ${card.rarity}` : ""}
        </div>
        <AddToBinder cardId={card.id} />
      </div>
    </div>
  );
}
